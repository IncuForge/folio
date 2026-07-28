import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../shell/app_shell.dart';
import 'setup_view_model.dart';

class SetupView extends StatelessWidget {
  const SetupView({super.key});
  @override
  Widget build(BuildContext context) => Selector<SetupViewModel, SetupState>(
    selector: (_, vm) => vm.state,
    builder: (context, state, _) {
      if (state.stage == SetupStage.loading) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (state.stage == SetupStage.ready) {
        return const AppShell();
      }
      return PopScope(
        canPop: state.stage != SetupStage.connect,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && state.stage == SetupStage.connect && !state.busy) {
            context.read<SetupViewModel>().back();
          }
        },
        child: Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: AnimatedSwitcher(
                    duration: Duration(
                      milliseconds: MediaQuery.disableAnimationsOf(context)
                          ? 0
                          : 180,
                    ),
                    child: state.stage == SetupStage.connect
                        ? _ConnectPanel(state: state)
                        : _ChoicePanel(state: state),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _Brand extends StatelessWidget {
  const _Brand();
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.onSurface,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Icon(
          Icons.menu_book_rounded,
          color: Theme.of(context).colorScheme.surface,
        ),
      ),
      const SizedBox(width: 12),
      Text('Folio', style: Theme.of(context).textTheme.headlineMedium),
    ],
  );
}

class _Frame extends StatelessWidget {
  const _Frame({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );
}

class _ChoicePanel extends StatelessWidget {
  const _ChoicePanel({required this.state});
  final SetupState state;
  @override
  Widget build(BuildContext context) {
    final vm = context.read<SetupViewModel>();
    return _Frame(
      key: const ValueKey('choice'),
      children: [
        const Align(alignment: Alignment.centerLeft, child: _Brand()),
        const SizedBox(height: 40),
        Text(
          'Set up this phone',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 10),
        Text(
          'Use Folio with your desktop workspace, or keep an independent workspace on this device.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 32),
        _SetupOption(
          icon: Icons.devices_rounded,
          title: 'Connect to Folio Desktop',
          description:
              'Pair securely, download the current workspace, then keep working when the connection drops.',
          onTap: vm.chooseConnect,
        ),
        const SizedBox(height: 12),
        _SetupOption(
          icon: Icons.smartphone_rounded,
          title: 'Create on this phone',
          description:
              'Start an independent, offline workspace stored only on this Android device.',
          onTap: state.busy ? null : vm.createLocal,
        ),
        if (state.error != null) ...[
          const SizedBox(height: 16),
          Text(
            state.error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
      ],
    );
  }
}

class _ConnectPanel extends StatefulWidget {
  const _ConnectPanel({required this.state});
  final SetupState state;
  @override
  State<_ConnectPanel> createState() => _ConnectPanelState();
}

class _ConnectPanelState extends State<_ConnectPanel> {
  final address = TextEditingController();
  final code = TextEditingController();
  @override
  void dispose() {
    address.dispose();
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.read<SetupViewModel>();
    return _Frame(
      key: const ValueKey('connect'),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: widget.state.busy ? null : vm.back,
              icon: const Icon(Icons.arrow_back_rounded),
              tooltip: 'Back',
            ),
            const SizedBox(width: 8),
            const _Brand(),
          ],
        ),
        const SizedBox(height: 32),
        Text(
          'Connect to your desktop',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'On the desktop, open Settings → Devices → Pair new device. Enter the address and one-time code shown there.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 28),
        TextField(
          controller: address,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Desktop address',
            hintText: 'http://192.168.1.20:45454',
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: code,
          keyboardType: TextInputType.number,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Pairing code',
            hintText: '123456',
          ),
        ),
        if (widget.state.error != null) ...[
          const SizedBox(height: 14),
          Text(
            widget.state.error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: widget.state.busy
              ? null
              : () => vm.pair(address.text, code.text),
          icon: widget.state.busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.link_rounded),
          label: Text(widget.state.busy ? 'Connecting…' : 'Connect workspace'),
        ),
        const SizedBox(height: 12),
        Text(
          'The first connection must reach the desktop over the same Wi-Fi network or its VPN/Tailscale address. Later edits remain available offline.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _SetupOption extends StatelessWidget {
  const _SetupOption({
    required this.icon,
    required this.title,
    required this.description,
    this.onTap,
  });
  final IconData icon;
  final String title, description;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).dividerColor),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 26, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 5),
                  Text(
                    description,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    ),
  );
}
