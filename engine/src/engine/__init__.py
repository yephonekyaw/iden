"""Registers the pip-distributed CUDA/cuDNN DLLs before anything imports
onnxruntime.

Rather than requiring a system-wide CUDA Toolkit + cuDNN install (which needs
an NVIDIA developer login just to get cuDNN), we depend on the
`nvidia-cublas-cu12` / `nvidia-cudnn-cu12` / `nvidia-cuda-runtime-cu12` /
`nvidia-cufft-cu12` wheels and put their `bin/` directories on the DLL search
path ourselves.

Both `os.add_dll_directory` *and* `PATH` are needed, not just one:
`add_dll_directory` covers DLLs Python's own loader resolves (e.g. importing
`onnxruntime` itself), but onnxruntime's CUDA execution provider is a native
DLL that does its own internal `LoadLibrary` calls to pull in its
dependencies (`cudart64_12.dll`, `cudnn64_9.dll`, ...) — and cuDNN 9's
dispatch library (`cudnn64_9.dll`) in turn loads its own engine plugins
(`cudnn_ops64_9.dll` etc.) the same way. None of that chain reliably honors
`add_dll_directory`; confirmed on this machine that omitting the `PATH`
addition below reproduces `LoadLibrary failed with error 126` (module not
found) even though every one of these DLLs loads fine individually. `PATH`
is the one search mechanism every one of these calls actually respects.

This runs unconditionally and cheaply on CPU-only setups too — extra search
directories nothing ever loads from cost nothing.

This must happen here, in the package's own `__init__.py`, rather than in
`core/app.py` or `core/config.py`: importing `engine.anything` runs this
file first, before any submodule (and therefore before `insightface` /
`onnxruntime`) gets a chance to load.
"""

import os
import sys
from pathlib import Path

if sys.platform == "win32":
    _site_packages = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
    _capi = Path(sys.prefix) / "Lib" / "site-packages" / "onnxruntime" / "capi"
    _dirs = [_capi] + [
        _site_packages / _pkg / "bin"
        for _pkg in ("cublas", "cudnn", "cuda_runtime", "cufft")
    ]
    _existing = [str(_d) for _d in _dirs if _d.is_dir()]
    for _dir in _existing:
        os.add_dll_directory(_dir)
    if _existing:
        os.environ["PATH"] = (
            os.pathsep.join(_existing) + os.pathsep + os.environ["PATH"]
        )
