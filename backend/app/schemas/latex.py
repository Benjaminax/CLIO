from pydantic import BaseModel, ConfigDict, Field


class LatexCompileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1, max_length=200_000)
