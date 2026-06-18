"""
Scanner Agent — ERP ITP
Expõe o scanner local como endpoint HTTP para o sistema web.

Dependências:
    pip install pywin32 flask flask-cors

Iniciar:
    python scanner_agent.py

Para iniciar com o Windows: crie um atalho para este arquivo em
    shell:startup  (Win+R → shell:startup → colar atalho)
"""

import base64
import os
import tempfile

import pythoncom
import win32com.client
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    "https://itp.institutotiapretinha.org",
])


@app.route("/status")
def status():
    return jsonify({"ok": True, "version": "1.0", "service": "scanner-agent-itp"})


@app.route("/scan")
def scan():
    pythoncom.CoInitialize()
    try:
        wia = win32com.client.Dispatch("WIA.CommonDialog")
        # ShowAcquireImage(DeviceType, Intent, Bias, FormatID, AlwaysSelectDevice, UseCommonUI, CancelError)
        image = wia.ShowAcquireImage(
            1,       # ScannerDeviceType
            1,       # ColorIntent
            2,       # MinimizeSize bias
            "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}",  # JPEG
            False,   # AlwaysSelectDevice
            True,    # UseCommonUI (diálogo nativo do Windows)
            False,   # CancelError — retorna None ao cancelar, não lança exceção
        )

        if image is None:
            return jsonify({"error": "cancelled"}), 400

        tmp = tempfile.mktemp(suffix=".jpg")
        image.SaveFile(tmp)

        with open(tmp, "rb") as f:
            data = base64.b64encode(f.read()).decode()

        os.unlink(tmp)

        return jsonify({
            "ok": True,
            "data": f"data:image/jpeg;base64,{data}",
            "mimetype": "image/jpeg",
            "filename": "digitalizado.jpg",
        })

    except Exception as e:
        msg = str(e)
        # WIA error 0x80210015 = nenhum scanner disponível
        if "0x80210015" in msg or "No scanner" in msg.lower():
            return jsonify({"error": "Nenhum scanner encontrado. Verifique se está ligado e conectado."}), 503
        return jsonify({"error": msg}), 500

    finally:
        pythoncom.CoUninitialize()


if __name__ == "__main__":
    print("=" * 52)
    print("  Scanner Agent — ERP ITP")
    print("  Rodando em http://localhost:7734")
    print("  Ctrl+C para parar")
    print("=" * 52)
    app.run(host="127.0.0.1", port=7734, debug=False)
