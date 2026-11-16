import 'package:echo_front_agent_sdk/echo_front_agent_sdk.dart';

Decision decide(String unitId, Perception perception) => {
  'movement': {'direction': 0, 'speed': 0.5},
};

Future<void> main(List<String> args) async {
  if (args.contains('--help')) {
    print(
      'Usage: dart run example/runner.dart [ws://localhost:3001/agent] [name]',
    );
    return;
  }
  final agent = Agent(
    AgentOptions(
      url: args.isNotEmpty ? args[0] : 'ws://localhost:3001/agent',
      agentName: args.length > 1 ? args[1] : 'dart-runner',
      onPerception: decide,
    ),
  );
  try {
    await agent.connect();
  } finally {
    await agent.close();
  }
}
