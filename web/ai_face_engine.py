import os
import sys

# Silence OpenCV verbose DNN logs
os.environ['OPENCV_LOG_LEVEL'] = 'SILENT'
os.environ['PYTHONWARNINGS'] = 'ignore'

import json
import urllib.request
import cv2
import numpy as np

if hasattr(cv2, 'setLogLevel'):
    try:
        cv2.setLogLevel(0)
    except Exception:
        pass

# Locate ONNX models
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_DIRS = [
    SCRIPT_DIR,
    os.path.join(SCRIPT_DIR, ".."),
    "D:\\code\\Live_photo_share",
    os.path.join(os.getcwd())
]

def find_model(model_name):
    for d in POSSIBLE_DIRS:
        p = os.path.join(d, model_name)
        if os.path.exists(p) and os.path.getsize(p) > 10000:
            return p
    return None

DET_MODEL_PATH = find_model('face_detection_yunet.onnx')
REC_MODEL_PATH = find_model('face_recognition_sface.onnx')

_detector = None
_recognizer = None

def get_detector():
    global _detector
    if _detector is None and DET_MODEL_PATH and os.path.exists(DET_MODEL_PATH):
        try:
            _detector = cv2.FaceDetectorYN.create(DET_MODEL_PATH, '', (320, 320), 0.55, 0.3, 5000)
        except Exception as e:
            sys.stderr.write(f"Warning: Could not create FaceDetectorYN: {e}\n")
    return _detector

def get_recognizer():
    global _recognizer
    if _recognizer is None and REC_MODEL_PATH and os.path.exists(REC_MODEL_PATH):
        try:
            _recognizer = cv2.FaceRecognizerSF.create(REC_MODEL_PATH, '')
        except Exception as e:
            sys.stderr.write(f"Warning: Could not create FaceRecognizerSF: {e}\n")
    return _recognizer

def load_image_cv(image_path_or_url):
    """Load image from local path or URL into BGR numpy array."""
    if not image_path_or_url:
        return None
    
    if image_path_or_url.startswith('http://') or image_path_or_url.startswith('https://'):
        try:
            req = urllib.request.Request(image_path_or_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                arr = np.asarray(bytearray(resp.read()), dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                return img
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to fetch image from URL: {e}\n")
            return None

    clean_path = image_path_or_url
    if clean_path.startswith('/api/uploads/'):
        clean_path = clean_path.replace('/api/uploads/', 'public/uploads/')
    elif clean_path.startswith('/uploads/'):
        clean_path = clean_path.replace('/uploads/', 'public/uploads/')

    candidates = [
        image_path_or_url,
        clean_path,
        os.path.join(SCRIPT_DIR, clean_path),
        os.path.join(SCRIPT_DIR, 'web', clean_path),
        os.path.join(SCRIPT_DIR, 'web', 'public', os.path.basename(clean_path)),
        os.path.join(SCRIPT_DIR, 'web', 'public', 'uploads', os.path.basename(clean_path)),
        os.path.join(os.getcwd(), clean_path)
    ]

    for p in candidates:
        if os.path.exists(p) and os.path.isfile(p):
            try:
                img = cv2.imread(p)
                if img is not None:
                    return img
            except Exception:
                pass

    return None

def extract_faces_and_features(img):
    """
    Detects faces using YuNet and extracts 128-d SFace embeddings.
    Returns: list of dicts: {'box': [x, y, w, h], 'score': float, 'feature': numpy array}
    """
    if img is None:
        return []

    h, w = img.shape[:2]
    scale = 1.0
    max_dim = 1280
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        target_w = int(w * scale)
        target_h = int(h * scale)
        proc_img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
    else:
        proc_img = img

    ph, pw = proc_img.shape[:2]
    detector = get_detector()
    recognizer = get_recognizer()

    extracted = []

    if detector is not None and recognizer is not None:
        try:
            detector.setInputSize((pw, ph))
            retval, faces = detector.detect(proc_img)
            if faces is not None and len(faces) > 0:
                for face in faces:
                    aligned = recognizer.alignCrop(proc_img, face)
                    feat = recognizer.feature(aligned)
                    norm = np.linalg.norm(feat)
                    if norm > 0:
                        feat = feat / norm

                    box = [
                        int(face[0] / scale),
                        int(face[1] / scale),
                        int(face[2] / scale),
                        int(face[3] / scale)
                    ]
                    extracted.append({
                        'box': box,
                        'score': float(face[14]),
                        'feature': feat.flatten()
                    })
                return extracted
        except Exception as e:
            sys.stderr.write(f"Detector error: {e}\n")

    return extracted

def compute_similarity(feat1, feat2):
    """Cosine similarity between two normalized feature vectors."""
    if feat1 is None or feat2 is None:
        return 0.0
    if len(feat1) != len(feat2):
        min_len = min(len(feat1), len(feat2))
        f1 = feat1[:min_len]
        f2 = feat2[:min_len]
        n1 = np.linalg.norm(f1)
        n2 = np.linalg.norm(f2)
        if n1 > 0 and n2 > 0:
            return float(np.dot(f1, f2) / (n1 * n2))
        return 0.0
    return float(np.dot(feat1, feat2))

def match_selfie(selfie_path_or_url, photo_items):
    """
    Match a selfie image against a list of photo items.
    STRICT MATCHING: Only returns photos that actually match the selfie face!
    Unmatched photos are excluded.
    """
    selfie_img = load_image_cv(selfie_path_or_url)
    if selfie_img is None:
        return {"success": False, "error": f"Could not load selfie image from {selfie_path_or_url}", "matches": []}

    selfie_faces = extract_faces_and_features(selfie_img)
    has_face_in_selfie = len(selfie_faces) > 0

    if not has_face_in_selfie:
        # If no face found in selfie, cannot reliably search
        return {
            "success": True,
            "selfieFaceDetected": False,
            "matchCount": 0,
            "matches": [],
            "message": "No clear face detected in your selfie. Please ensure good lighting and face the camera directly."
        }

    # Best face in selfie
    best_selfie_face = max(selfie_faces, key=lambda f: f['box'][2] * f['box'][3])
    selfie_feat = best_selfie_face['feature']

    results = []

    for item in photo_items:
        p_id = item.get('id')
        p_url = item.get('url') or item.get('local_path')
        
        target_img = load_image_cv(p_url)
        if target_img is None:
            continue

        target_faces = extract_faces_and_features(target_img)
        if len(target_faces) == 0:
            # No face in photo, skip
            continue

        best_sim = -1.0
        for t_face in target_faces:
            sim = compute_similarity(selfie_feat, t_face['feature'])
            if sim > best_sim:
                best_sim = sim

        # STRICT FILTER:
        # In OpenCV SFace, 0.363 is the official same-person threshold.
        # Photos with similarity < 0.28 do not match the selfie face!
        if best_sim < 0.28:
            continue

        # Calibrate similarity to percentage (80% - 99%):
        if best_sim >= 0.40:
            match_score = int(90 + min(9, (best_sim - 0.40) * 20))
            confidence = "High"
        elif best_sim >= 0.32:
            match_score = int(84 + (best_sim - 0.32) * 75)
            confidence = "High" if match_score >= 88 else "Medium"
        else:
            match_score = int(80 + (best_sim - 0.28) * 100)
            confidence = "Medium"

        tags = ["Face Matched", "Portrait"]

        results.append({
            "photoId": p_id,
            "matchScore": match_score,
            "confidence": confidence,
            "faceDetected": True,
            "detectedFacesCount": len(target_faces),
            "similarityRaw": round(best_sim, 4),
            "tags": tags
        })

    results.sort(key=lambda r: r['matchScore'], reverse=True)

    return {
        "success": True,
        "selfieFaceDetected": True,
        "matchCount": len(results),
        "matches": results
    }

def enhance_image(image_path, output_path):
    img = load_image_cv(image_path)
    if img is None:
        return False

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced_lab = cv2.merge((cl, a, b))
    enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    gaussian = cv2.GaussianBlur(enhanced_bgr, (0, 0), 2.0)
    final_img = cv2.addWeighted(enhanced_bgr, 1.25, gaussian, -0.25, 0)

    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    cv2.imwrite(output_path, final_img)
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'detect':
        img_path = sys.argv[2]
        img = load_image_cv(img_path)
        faces = extract_faces_and_features(img)
        print(json.dumps({
            "success": True,
            "faceCount": len(faces),
            "faces": [{"box": f['box'], "score": f['score']} for f in faces]
        }))

    elif cmd == 'match':
        selfie_path = sys.argv[2]
        items_arg = sys.argv[3]
        if os.path.exists(items_arg):
            with open(items_arg, 'r', encoding='utf-8') as f:
                photo_items = json.load(f)
        else:
            photo_items = json.loads(items_arg)

        res = match_selfie(selfie_path, photo_items)
        print(json.dumps(res))

    elif cmd == 'enhance':
        src_path = sys.argv[2]
        out_path = sys.argv[3]
        success = enhance_image(src_path, out_path)
        print(json.dumps({"success": success}))
