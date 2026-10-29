#!/usr/bin/env python3
"""
HP OMEN GPU Diagnostics & Health Check
Queries NVIDIA hardware, driver, VRAM capacity, and PyTorch CUDA compatibility.
"""

import sys
import json
import subprocess
import shutil

def get_nvidia_smi():
    smi = shutil.which("nvidia-smi")
    if not smi:
        return {"available": False, "error": "nvidia-smi executable not found in PATH."}
    
    try:
        query_cmd = [
            smi,
            "--query-gpu=name,driver_version,memory.total,memory.free,memory.used,temperature.gpu,utilization.gpu",
            "--format=csv,noheader,nounits"
        ]
        output = subprocess.check_output(query_cmd, universal_newlines=True).strip()
        lines = output.splitlines()
        gpus = []
        for line in lines:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 7:
                gpus.append({
                    "gpu_name": parts[0],
                    "driver_version": parts[1],
                    "vram_total_mb": float(parts[2]),
                    "vram_free_mb": float(parts[3]),
                    "vram_used_mb": float(parts[4]),
                    "temperature_c": float(parts[5]),
                    "utilization_pct": float(parts[6])
                })
        return {"available": True, "gpus": gpus}
    except Exception as e:
        return {"available": False, "error": str(e)}

def get_pytorch_info():
    try:
        import torch
        return {
            "torch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        }
    except ImportError:
        return {"torch_installed": False, "message": "PyTorch not installed in active Python environment."}

def main():
    print("=" * 60)
    print("🖥️  HP OMEN GPU Worker Diagnostics")
    print("=" * 60)

    smi_info = get_nvidia_smi()
    torch_info = get_pytorch_info()

    report = {
        "nvidia_smi": smi_info,
        "pytorch": torch_info
    }

    if smi_info.get("available"):
        for i, gpu in enumerate(smi_info["gpus"]):
            print(f"✅ GPU {i}: {gpu['gpu_name']}")
            print(f"   Driver:       {gpu['driver_version']}")
            print(f"   VRAM Total:   {gpu['vram_total_mb']:.0f} MB")
            print(f"   VRAM Free:    {gpu['vram_free_mb']:.0f} MB")
            print(f"   GPU Temp:     {gpu['temperature_c']} °C")
            print(f"   Utilization:  {gpu['utilization_pct']}%")
    else:
        print(f"⚠️  NVIDIA SMI Notice: {smi_info.get('error')}")

    print("\n📦 PyTorch / CUDA Status:")
    if torch_info.get("cuda_available"):
        print(f"✅ PyTorch {torch_info['torch_version']} with CUDA active on {torch_info['device_name']}")
    else:
        print(f"ℹ️  {torch_info.get('message', 'CUDA not active in PyTorch')}")

    print("=" * 60)
    if "--json" in sys.argv:
        print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
