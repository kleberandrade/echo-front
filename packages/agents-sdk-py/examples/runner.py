"""Minimal moving agent: run two instances against a local ECHO//FRONT server."""
import argparse
import asyncio

from echo_front_agent_sdk import Agent, AgentOptions, Decision, Perception


def decide(unit_id: str, perception: Perception) -> Decision:
    return {"movement": {"direction": 0, "speed": 0.5}}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="ws://localhost:3001/agent")
    parser.add_argument("--name", default="python-runner")
    args = parser.parse_args()
    agent = Agent(AgentOptions(url=args.url, agent_name=args.name, on_perception=decide))
    try:
        await agent.connect()
    finally:
        await agent.close()


if __name__ == "__main__":
    asyncio.run(main())
