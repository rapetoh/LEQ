"""pytest for extraire.py: a synthetic tone must read back at its frequency,
silence must be unvoiced, and the CLI must write valid JSON."""

import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import extraire  # noqa: E402

FREQUENCE_HZ = 16000


def sinus(duree_s: float, f_hz: float, amplitude: float = 0.5) -> np.ndarray:
    t = np.arange(int(duree_s * FREQUENCE_HZ)) / FREQUENCE_HZ
    return (amplitude * np.sin(2 * math.pi * f_hz * t)).astype("<f4")


def ecrire_f32le(chemin: Path, echantillons: np.ndarray) -> None:
    echantillons.astype("<f4").tofile(chemin)


def test_tone_is_read_at_its_frequency(tmp_path: Path) -> None:
    fichier = tmp_path / "ton.f32le"
    ecrire_f32le(fichier, sinus(2.0, 220.0))
    son = extraire.charger(str(fichier), "f32le", FREQUENCE_HZ)
    pistes = extraire.extraire(son, 0.01)
    assert len(pistes["f0_hz"]) == 200
    assert len(pistes["intensite_db"]) == 200
    voisees = [f for f in pistes["f0_hz"][20:180] if f is not None]
    assert len(voisees) > 140
    assert abs(float(np.median(voisees)) - 220.0) < 5.0
    niveaux = [d for d in pistes["intensite_db"][20:180] if d is not None]
    # a 0.5 amplitude sine is about -9 dBFS RMS
    assert abs(float(np.median(niveaux)) - (-9.0)) < 2.0


def test_silence_is_unvoiced(tmp_path: Path) -> None:
    fichier = tmp_path / "mixte.f32le"
    ecrire_f32le(fichier, np.concatenate([sinus(1.0, 180.0), np.zeros(FREQUENCE_HZ, dtype="<f4")]))
    son = extraire.charger(str(fichier), "f32le", FREQUENCE_HZ)
    pistes = extraire.extraire(son, 0.01)
    assert len(pistes["f0_hz"]) == 200
    assert all(f is None for f in pistes["f0_hz"][120:190])
    assert any(f is not None for f in pistes["f0_hz"][10:90])


def test_too_short_sound_gives_null_tracks(tmp_path: Path) -> None:
    fichier = tmp_path / "court.f32le"
    ecrire_f32le(fichier, sinus(0.05, 200.0))
    son = extraire.charger(str(fichier), "f32le", FREQUENCE_HZ)
    pistes = extraire.extraire(son, 0.01)
    assert len(pistes["f0_hz"]) == 5
    assert pistes["f0_hz"] == [None] * 5


def test_cli_writes_json(tmp_path: Path) -> None:
    fichier = tmp_path / "ton.f32le"
    ecrire_f32le(fichier, sinus(1.0, 150.0))
    resultat = subprocess.run(
        [sys.executable, str(ICI / "extraire.py"), "--entree", str(fichier), "--format", "f32le", "--frequence", str(FREQUENCE_HZ)],
        capture_output=True,
        text=True,
        check=True,
    )
    pistes = json.loads(resultat.stdout)
    assert pistes["pas_s"] == pytest.approx(0.01)
    assert len(pistes["f0_hz"]) == 100
