# File: GlobalAcademy-AiEngine/app/graphs/v2_agent_orchestrator.py
import os
from typing import Literal, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from app.graphs.v2_agent_state import SmartCourtAgentState
from app.services.v2_tools_service import smart_court_tools_list

class v2AgentOrchestrator:
    # 🚀 INITIALIZE COMPONENT MODELS AND TOOLS BINDINGS
    _model = ChatOpenAI(model="gpt-5.4-mini", api_key=os.getenv("OPENAI_API_KEY"), temperature=0.0)
    _model_with_tools = _model.bind_tools(smart_court_tools_list)
    
    # Pre-built tool executor node handles running the matching function when requested
    _tool_node = ToolNode(smart_court_tools_list)

    @classmethod
    async def call_oracle_node(cls, state: SmartCourtAgentState) -> Dict[str, Any]:
        """
        The Oracle Reasoning Node. Evaluates rolling message arrays, appends multi-tenant 
        system parameters, and determines if it requires database actions.
        """
        messages_pool = list(state.get("messages", []))
        academy_id = state.get("academy_id")
        branch_id = state.get("branch_id")
        court_id = state.get("court_id")

        # Inject strict system context instructions directly into the thinking layer
        system_instruction = (
            "You are the senior executive Smart Court Operator Brain. You have access to tools "
            "to query facility knowledge manuals and update court operational statuses.\n"
            f"CRITICAL SYSTEM GAURDRAILS:\n"
            f"- Active Tenant AcademyId: {academy_id}\n"
            f"- Active BranchId: {branch_id}\n"
            f"- Focused Court Asset Id Target: {court_id if court_id else 'None/Broad Scope'}\n"
            "You MUST always forward these ID values exactly into any tool executions you make. "
            "If document parameters indicate a threshold violation, you must autonomously "
            "call the status adjustment tool to lock that specific court asset row."
        )
        
        # Structure the payload safely for the LLM execution processing window
        from langchain_core.messages import SystemMessage
        execution_messages = [SystemMessage(content=system_instruction)] + messages_pool
        
        # Execute the model loop pass
        response = await cls._model_with_tools.ainvoke(execution_messages)
        
        # Return an incremental update map matching our TypedDict state properties
        return {"messages": [response]}

    @classmethod
    def routing_condition_edge(cls, state: SmartCourtAgentState) -> Literal["tools", "__end__"]:
        """
        Conditional Router Edge. Inspects the last message returned by the Oracle Node.
        If OpenAI requested tool arguments, routes to the Action Rails, otherwise exits the loop.
        """
        messages = state.get("messages", [])
        if not messages:
            return "__end__"
            
        last_message = messages[-1]
        
        # If the last message contains tool_calls parameter arrays, divert to the tools executor node
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
            
        return "__end__"

    @classmethod
    def compile_agent_graph(cls):
        """
        Assembles, binds, and compiles the physical nodes and conditional edges 
        into a finalized runtime State Machine workflow instance.
        """
        # 1. Instantiate the StateGraph bound to our specific shared memory structural contract
        workflow_builder = StateGraph(SmartCourtAgentState)

        # 2. Register the execution computing nodes inside the graph layout mesh
        workflow_builder.add_node("oracle", cls.call_oracle_node)
        workflow_builder.add_node("tools", cls._tool_node)

        # 3. Define the physical workflow step entry point anchors
        workflow_builder.add_edge(START, "oracle")

        # 4. Inject the conditional routing gates on exit out of the reasoning layer
        workflow_builder.add_conditional_edges(
            "oracle",
            cls.routing_condition_edge,
            {
                "tools": "tools",
                "__end__": END
            }
        )

        # 5. Connect the tool execution node output back into the oracle input for rolling evaluation loops
        workflow_builder.add_edge("tools", "oracle")

        # 6. Compile the architecture into a runnable engine instance wrapper
        compiled_agent_executor = workflow_builder.compile()
        print("🧬 [v2 GRAPH ORCHESTRATOR]: Agentic State Machine Compiled Successfully.")
        return compiled_agent_executor

# Initialize a centralized instance property ready for runtime call actions
smart_court_agent_engine = v2AgentOrchestrator.compile_agent_graph()
