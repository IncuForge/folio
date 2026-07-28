import 'package:dio/dio.dart';

class PairResult {
  const PairResult({
    required this.token,
    required this.revision,
    required this.snapshotUrl,
  });
  final String token;
  final int revision;
  final String snapshotUrl;
}

class SnapshotResult {
  const SnapshotResult({required this.revision, required this.snapshot});
  final int revision;
  final Map<String, dynamic> snapshot;
}

class CommitResult {
  const CommitResult({
    required this.accepted,
    required this.revision,
    this.snapshot,
    this.error,
  });
  final bool accepted;
  final int revision;
  final Map<String, dynamic>? snapshot;
  final String? error;
}

class SyncApiService {
  SyncApiService()
    : _dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 20),
          contentType: Headers.jsonContentType,
        ),
      );
  final Dio _dio;

  Future<PairResult> pair({
    required String address,
    required String code,
    required String deviceId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '${_clean(address)}/pair',
      data: {'code': code, 'deviceName': 'Folio Android', 'deviceId': deviceId},
    );
    final data = response.data!;
    return PairResult(
      token: data['deviceToken'] as String,
      revision: (data['revision'] as num).toInt(),
      snapshotUrl: data['snapshotUrl'] as String,
    );
  }

  Future<SnapshotResult> snapshot({
    required String address,
    required String token,
    String path = '/snapshot',
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '${_clean(address)}$path',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
    final data = response.data!;
    return SnapshotResult(
      revision: (data['revision'] as num).toInt(),
      snapshot: Map<String, dynamic>.from(data['snapshot'] as Map),
    );
  }

  Future<CommitResult> commit({
    required String address,
    required String token,
    required int baseRevision,
    required Map<String, dynamic> snapshot,
    required String commitId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${_clean(address)}/sync',
        data: {
          'commitId': commitId,
          'baseRevision': baseRevision,
          'snapshot': snapshot,
        },
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
          validateStatus: (status) => status != null && status < 500,
        ),
      );
      final data = response.data ?? const <String, dynamic>{};
      return CommitResult(
        accepted: data['accepted'] == true,
        revision: (data['revision'] as num?)?.toInt() ?? baseRevision,
        snapshot: data['snapshot'] is Map
            ? Map<String, dynamic>.from(data['snapshot'] as Map)
            : null,
        error: data['error'] as String?,
      );
    } on DioException catch (error) {
      throw Exception(
        error.response?.statusCode == 401
            ? 'This phone was revoked. Pair it again from Folio Desktop.'
            : 'Folio Desktop is currently unreachable.',
      );
    }
  }

  String _clean(String value) => value.trim().replaceFirst(RegExp(r'/$'), '');
}
