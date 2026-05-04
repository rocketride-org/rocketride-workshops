from fastapi import FastAPI, HTTPException

from app.pipelines.sdk.hello_client import run_hello

app = FastAPI(title="coding-agent exercise")


@app.get("/api/hello")
async def hello() -> dict[str, str]:
    # TODO: replace this with `message = await run_hello()` once you've
    # implemented the SDK client in app/pipelines/sdk/hello_client.py.
    raise HTTPException(
        status_code=501,
        detail="Not implemented yet. See workshop instructions.",
    )
    message = await run_hello()  # noqa: F841 (kept as a hint)
    return {"message": message}
