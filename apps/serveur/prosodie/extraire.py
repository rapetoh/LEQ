#!/usr/bin/env python3
"""Pitch (F0) and intensity tracks out of PCM, with Praat through parselmouth.

Usage:
    python3 extraire.py --entree <file> --format f32le --frequence 16000 [--pas 0.01]
    python3 extraire.py --entree <file.wav> --format wav

Writes one JSON object on stdout:
    {"pas_s": 0.01, "f0_hz": [...], "intensite_db": [...]}

Frame i covers [i * pas_s, (i + 1) * pas_s) and is sampled at its centre.
f0_hz is null on unvoiced or silent frames. intensite_db is expressed in dBFS
(RMS, full-scale sine at about -3 dB) so it matches the engine's own RMS
levels; Praat reports dB re 2e-5 Pa for a signal in [-1, 1], hence the offset.
Sounds shorter than what Praat needs for an analysis window yield all-null
tracks of the right length instead of an error.
"""

from __future__ import annotations

import argparse
import json
import math
import sys

import numpy as np
import parselmouth

F0_MIN_HZ = 60.0
F0_MAX_HZ = 500.0
PAS_S_DEFAUT = 0.01
# Praat: intensity needs 6.4 / minimum_pitch seconds; pitch needs 3 periods of the floor.
DUREE_MIN_S = 6.4 / F0_MIN_HZ
# 20 * log10(1 / 2e-5): Praat's dB for a full-scale signal; subtracting it gives dBFS.
DECALAGE_DBFS = 20.0 * math.log10(1.0 / 2e-5)


def charger(chemin: str, fmt: str, frequence_hz: int) -> parselmouth.Sound:
    if fmt == "f32le":
        donnees = np.fromfile(chemin, dtype="<f4").astype(np.float64)
        return parselmouth.Sound(donnees, sampling_frequency=frequence_hz)
    son = parselmouth.Sound(chemin)
    if son.n_channels > 1:
        son = son.convert_to_mono()
    return son


def extraire(son: parselmouth.Sound, pas_s: float) -> dict:
    duree_s = son.get_total_duration()
    n = int(math.floor(duree_s / pas_s))
    f0: list = [None] * n
    intensite: list = [None] * n
    if n == 0 or duree_s < DUREE_MIN_S:
        return {"pas_s": pas_s, "f0_hz": f0, "intensite_db": intensite}

    pitch = son.to_pitch(time_step=pas_s, pitch_floor=F0_MIN_HZ, pitch_ceiling=F0_MAX_HZ)
    intensity = son.to_intensity(minimum_pitch=F0_MIN_HZ, time_step=pas_s)

    for i in range(n):
        t = (i + 0.5) * pas_s
        valeur_f0 = pitch.get_value_at_time(t)
        if valeur_f0 is not None and not math.isnan(valeur_f0) and valeur_f0 > 0:
            f0[i] = round(float(valeur_f0), 2)
        valeur_db = intensity.get_value(t)
        if valeur_db is not None and not math.isnan(valeur_db):
            intensite[i] = round(float(valeur_db) - DECALAGE_DBFS, 2)
    return {"pas_s": pas_s, "f0_hz": f0, "intensite_db": intensite}


def principal(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description="Pistes F0 et intensité avec Praat")
    parseur.add_argument("--entree", required=True, help="fichier audio")
    parseur.add_argument("--format", choices=["f32le", "wav"], default="f32le")
    parseur.add_argument("--frequence", type=int, default=16000, help="Hz, pour f32le")
    parseur.add_argument("--pas", type=float, default=PAS_S_DEFAUT, help="pas des trames en secondes")
    args = parseur.parse_args(argv)
    if args.pas <= 0:
        print("--pas doit être strictement positif", file=sys.stderr)
        return 2
    son = charger(args.entree, args.format, args.frequence)
    json.dump(extraire(son, args.pas), sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
