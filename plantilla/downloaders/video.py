"""Descarga de videos y playlists con yt-dlp (gratis, local)."""
import os

from config import DOWNLOAD_DIR


def _ydl_opts(audio_only=False, playlist=False):
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    opts = {
        "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
    }
    if not playlist:
        opts["noplaylist"] = True
    if audio_only:
        opts["format"] = "bestaudio/best"
    else:
        opts["format"] = "best[height<=720]/best"
    return opts


def download_video(url, audio_only=False):
    import yt_dlp

    with yt_dlp.YoutubeDL(_ydl_opts(audio_only)) as ydl:
        info = ydl.extract_info(url, download=True)
        return {
            "title": info.get("title"),
            "path": ydl.prepare_filename(info),
            "duration": info.get("duration"),
            "ext": info.get("ext"),
        }


def download_playlist(url, audio_only=False):
    """Descarga una playlist/URL completa en downloads/."""
    import yt_dlp

    opts = _ydl_opts(audio_only, playlist=True)
    opts["outtmpl"] = os.path.join(DOWNLOAD_DIR, "%(playlist_title)s",
                                   "%(playlist_index)s - %(title)s.%(ext)s")
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return {
            "title": info.get("title"),
            "entries": len(info.get("entries") or []),
            "dir": DOWNLOAD_DIR,
        }


def video_info(url):
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
        info = ydl.extract_info(url, download=False)
        return {
            "title": info.get("title"),
            "duration": info.get("duration"),
            "uploader": info.get("uploader"),
            "is_playlist": bool(info.get("_type") == "playlist"
                                or info.get("entries")),
            "formats": len(info.get("formats", [])),
        }
