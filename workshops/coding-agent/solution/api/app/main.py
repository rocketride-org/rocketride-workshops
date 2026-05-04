from fastapi import FastAPI

from app.pipelines.sdk.hello_client import run_hello

app = FastAPI(title="coding-agent solution")


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    message = await run_hello()
    return {"message": message}
