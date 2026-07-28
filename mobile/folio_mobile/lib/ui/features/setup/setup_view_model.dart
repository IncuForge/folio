import 'package:flutter/foundation.dart';
import '../../../data/repositories/sync_repository.dart';

enum SetupStage { loading, choose, connect, ready }

class SetupState {
  const SetupState({required this.stage, this.busy = false, this.error});
  final SetupStage stage;
  final bool busy;
  final String? error;
  SetupState copyWith({
    SetupStage? stage,
    bool? busy,
    String? error,
    bool clearError = false,
  }) => SetupState(
    stage: stage ?? this.stage,
    busy: busy ?? this.busy,
    error: clearError ? null : error ?? this.error,
  );
}

class SetupViewModel extends ChangeNotifier {
  SetupViewModel(this._repository);
  final SyncRepository _repository;
  SetupState _state = const SetupState(stage: SetupStage.loading);
  SetupState get state => _state;
  Future<void> load() async {
    final configured = await _repository.isConfigured();
    _emit(SetupState(stage: configured ? SetupStage.ready : SetupStage.choose));
  }

  void chooseConnect() => _emit(const SetupState(stage: SetupStage.connect));
  void back() => _emit(const SetupState(stage: SetupStage.choose));
  Future<void> createLocal() async {
    _emit(state.copyWith(busy: true, clearError: true));
    try {
      await _repository.createLocalWorkspace();
      _emit(const SetupState(stage: SetupStage.ready));
    } catch (e) {
      _emit(
        state.copyWith(
          busy: false,
          error: 'Could not create the local workspace.',
        ),
      );
    }
  }

  Future<void> pair(String address, String code) async {
    if (address.trim().isEmpty || code.trim().isEmpty) {
      _emit(
        state.copyWith(error: 'Enter the desktop address and pairing code.'),
      );
      return;
    }
    _emit(state.copyWith(busy: true, clearError: true));
    try {
      await _repository.pair(address: address, code: code);
      _emit(const SetupState(stage: SetupStage.ready));
    } catch (e) {
      _emit(
        state.copyWith(
          busy: false,
          error: 'The desktop could not be reached or rejected this code.',
        ),
      );
    }
  }

  void _emit(SetupState value) {
    _state = value;
    notifyListeners();
  }
}
