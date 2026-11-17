import os

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "workspace", "downloads")


def download_video(url, audio_only=False):
    import yt_dlp

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    opts = {
        "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    if audio_only:
        opts["format"] = "bestaudio/best"
    else:
        opts["format"] = "best[height<=720]/best"
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        path = ydl.prepare_filename(info)
        return {
            "title": info.get("title"),
            "path": path,
            "duration": info.get("duration"),
            "ext": info.get("ext"),
        }


def video_info(url):
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
        info = ydl.extract_info(url, download=False)
        return {
            "title": info.get("title"),
            "duration": info.get("duration"),
            "uploader": info.get("uploader"),
            "formats": len(info.get("formats", [])),
        }
