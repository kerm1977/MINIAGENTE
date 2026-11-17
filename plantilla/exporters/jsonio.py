"""Exportación/importación JSON."""
import json


def to_json(data, title, out_fn):
    path = out_fn(title, "json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def from_json(path_or_text):
    import os
    if os.path.exists(path_or_text):
        with open(path_or_text, encoding="utf-8") as f:
            return json.load(f)
    return json.loads(path_or_text)
