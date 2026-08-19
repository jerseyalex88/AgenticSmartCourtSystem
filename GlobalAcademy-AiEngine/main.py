from fastapi import FastAPI
# 1. Import your modular router controllers
from routers import pricing_agent, maintenance_agent

app = FastAPI(
    title="Smart Court Agentic AI Engine",
    description="Advanced Operational Heart for Global Academy ERP Ecosystem Platforms",
    version="1.0.0"
)

# 🚀 2. REGISTER THE ROUTERS (Exactly like app.MapControllers() in .NET)
app.include_router(pricing_agent.router)
app.include_router(maintenance_agent.router)

@app.get("/")
def read_root():
    return {"status": "Online", "mode": "Modular Gateway Routing Engaged"}
