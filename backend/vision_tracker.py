import cv2
import mediapipe as mp
import time

def monitor_vision():
    print("Iniciando monitorización por visión computarizada (OpenCV + MediaPipe)...")
    
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    
    cap = cv2.VideoCapture(0)
    
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            print("No se pudo leer el frame de la cámara. Ignorando...")
            time.sleep(1)
            continue

        image.flags.writeable = False
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(image)

        image.flags.writeable = True
        
        # Aquí se implementaría la lógica para Gaze Tracking o evaluación de postura.
        # Por ahora solo detectamos si hay una cara presente.
        if results.multi_face_landmarks:
            # print("Cara detectada, usuario mirando a la pantalla.")
            pass
        else:
            # print("Cara NO detectada. Posible distracción.")
            pass
            
        if cv2.waitKey(2000) & 0xFF == 27: # Espera 2 segundos o hasta que se presione ESC
            break
            
    cap.release()

if __name__ == "__main__":
    monitor_vision()
