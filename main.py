import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Verify API key
if not os.environ.get("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY environment variable is not set.")
    print("Please create a '.env' file based on '.env.example' and set your OpenAI API key.")
    sys.exit(1)

# Initialize/seed SQLite database first
try:
    print("Setting up the live inventory database...")
    from db_setup import init_db
    init_db()
except Exception as e:
    print(f"Error initializing the database: {e}")
    sys.exit(1)

# Import CrewAI components
# We import these after db initialization to ensure environment and DB are ready
try:
    from crewai import Crew
    from agents import interface_agent, sql_agent, alerts_agent, analysis_agent
    from tasks import sql_query_task, alerts_task, analysis_task, interface_task
except ImportError as e:
    print(f"Error importing CrewAI or dependencies: {e}")
    print("Please make sure you have installed all packages in requirements.txt.")
    sys.exit(1)

def run_inventory_crew():
    print("\nInitializing the Automatix Inventory Squad...")
    
    # Assemble the Crew
    inventory_crew = Crew(
        agents=[interface_agent, sql_agent, alerts_agent, analysis_agent],
        tasks=[sql_query_task, alerts_task, analysis_task, interface_task],
        verbose=True
    )
    
    # Define the primary natural language instruction from store management
    inputs = {
        "query": (
            "Perform a comprehensive review of our multi-store UAE inventory. "
            "Scan for low stock (at or below threshold) or near-expiry items across all branches. "
            "Determine if low stock can be resolved using inter-branch transfers based on connection distances and "
            "allowable transfer configurations. If transfers aren't feasible, recommend external supplier orders using "
            "the appropriate reorder multipliers, and suggest promotions for near-expiry products."
        )
    }
    
    print("Kicking off the Multi-Agent System. This may take a minute...\n")
    result = inventory_crew.kickoff(inputs=inputs)
    
    print("\n--- Execution Complete ---")
    print("Saving the resulting dashboard report to 'report.md'...")
    
    # Save the output to report.md in the workspace
    report_path = os.path.join(os.path.dirname(__file__), "report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(result)
        
    print(f"Dashboard report successfully written to: {report_path}")
    print("\nResult Dashboard:\n")
    print(result)

if __name__ == "__main__":
    run_inventory_crew()
