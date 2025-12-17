from __future__ import annotations

import base64
from io import BytesIO

import qrcode


def qr_png_base64(data: str, box_size: int = 8, border: int = 2) -> str:
    """
    Generate a PNG QR code for `data` and return it as a base64 string (no data: prefix).
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


