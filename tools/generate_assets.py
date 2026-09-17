#!/usr/bin/env python3
"""
Génère les textures utilisées par les scènes A-Frame du TP :
  - assets/textures/grass.jpg : texture d'herbe, tuilable (seamless) pour le sol
  - assets/textures/sky.jpg   : panorama équirectangulaire pour le skybox

Les textures sont procédurales (aucune image externe requise) pour que le
projet fonctionne sans dépendance réseau, en dehors des CDN d'A-Frame chargés
par le navigateur.

Usage: python3 tools/generate_assets.py
"""

import numpy as np
from PIL import Image

OUT_DIR = "assets/textures"


def periodic_noise(w, h, num_waves, freq_range, seed):
    """Bruit 2D périodique (donc tuilable à 100%) obtenu par somme de
    sinusoïdes dont les fréquences sont des multiples entiers de la période
    de l'image : sin(2*pi*(nx*x/w + ny*y/h) + phase) reste périodique sur
    [0, w) x [0, h) quelle que soit la phase choisie.
    """
    rng = np.random.default_rng(seed)
    x = np.arange(w)
    y = np.arange(h)
    X, Y = np.meshgrid(x, y)
    noise = np.zeros((h, w), dtype=np.float64)
    for _ in range(num_waves):
        nx = int(rng.integers(freq_range[0], freq_range[1] + 1)) * int(rng.choice([-1, 1]))
        ny = int(rng.integers(freq_range[0], freq_range[1] + 1)) * int(rng.choice([-1, 1]))
        if nx == 0 and ny == 0:
            continue
        phase = rng.uniform(0, 2 * np.pi)
        amp = rng.uniform(0.3, 1.0)
        noise += amp * np.sin(2 * np.pi * (nx * X / w + ny * Y / h) + phase)
    noise -= noise.min()
    if noise.max() > 0:
        noise /= noise.max()
    return noise


def make_grass_texture(size=512, seed=1):
    low = periodic_noise(size, size, 6, (1, 3), seed=seed)
    mid = periodic_noise(size, size, 18, (5, 14), seed=seed + 1)
    high = periodic_noise(size, size, 90, (25, 70), seed=seed + 2)
    speckle = periodic_noise(size, size, 160, (60, 140), seed=seed + 3)

    field = 0.35 * low + 0.2 * mid + 0.25 * high ** 1.6 + 0.2 * speckle ** 2
    field -= field.min()
    field /= field.max()
    field = field ** 1.3  # augmente le contraste pour un aspect "brins d'herbe"

    dark = np.array([32, 75, 26])
    mid_c = np.array([70, 122, 42])
    bright = np.array([150, 188, 78])

    t = field[..., None]
    color = np.where(
        t < 0.5,
        dark + (mid_c - dark) * (t / 0.5),
        mid_c + (bright - mid_c) * ((t - 0.5) / 0.5),
    )
    color = np.clip(color, 0, 255).astype(np.uint8)
    return Image.fromarray(color, mode="RGB")


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def make_sky_texture(width=2048, height=1024, seed=7):
    y = np.arange(height)
    t = (y / height)[:, None]  # 0 = zenith (haut), 1 = nadir (bas)

    zenith = np.array([50, 100, 195])
    horizon = np.array([200, 222, 236])
    below = np.array([150, 158, 130])

    t_up = smoothstep(0.0, 0.55, t)
    color_col = zenith + (horizon - zenith) * t_up
    t_down = smoothstep(0.55, 1.0, t)
    color_col = color_col + (below - color_col) * t_down * (t > 0.55)

    sky = np.repeat(color_col[:, None, :], width, axis=1)

    clouds = periodic_noise(width, height, 30, (2, 10), seed=seed)
    clouds_detail = periodic_noise(width, height, 60, (12, 30), seed=seed + 1)
    cloud_field = 0.7 * clouds + 0.3 * clouds_detail
    cloud_mask = smoothstep(0.55, 0.8, cloud_field)

    band = smoothstep(0.05, 0.25, t) * (1 - smoothstep(0.45, 0.6, t))
    cloud_alpha = (cloud_mask * band).clip(0, 1)

    cloud_color = np.array([255, 255, 255])
    sky = sky * (1 - cloud_alpha[..., None]) + cloud_color * cloud_alpha[..., None]

    sun_x, sun_y = int(width * 0.28), int(height * 0.30)
    xx, yy = np.meshgrid(np.arange(width), np.arange(height))
    dx = np.minimum(np.abs(xx - sun_x), width - np.abs(xx - sun_x))
    dy = yy - sun_y
    dist = np.sqrt(dx ** 2 + dy ** 2)
    sun_glow = np.exp(-(dist ** 2) / (2 * (width * 0.03) ** 2))
    sun_color = np.array([255, 250, 225])
    sky = sky * (1 - sun_glow[..., None] * 0.9) + sun_color * (sun_glow[..., None] * 0.9)

    sky = np.clip(sky, 0, 255).astype(np.uint8)
    return Image.fromarray(sky, mode="RGB")


if __name__ == "__main__":
    import os

    os.makedirs(OUT_DIR, exist_ok=True)

    grass = make_grass_texture()
    grass.save(os.path.join(OUT_DIR, "grass.jpg"), quality=90)
    print("Généré:", os.path.join(OUT_DIR, "grass.jpg"), grass.size)

    sky = make_sky_texture()
    sky.save(os.path.join(OUT_DIR, "sky.jpg"), quality=90)
    print("Généré:", os.path.join(OUT_DIR, "sky.jpg"), sky.size)
