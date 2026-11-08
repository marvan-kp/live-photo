import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useAdvancedCamera } from '../../hooks/useAdvancedCamera';

export default function AdvancedCamera() {
  const {
    settings,
    setSettings,
    isSmartFeatureEnabled,
    setIsSmartFeatureEnabled,
    detectedObjects,
    faces,
    currentScene,
    detectScene,
    detectFaces,
    detectObjects,
    applyAIOptimizedSettings,
    autoFocus,
    smartExposure
  } = useAdvancedCamera();

  const [showSceneDetection, setShowSceneDetection] = useState(false);
  const [showFaceDetection, setShowFaceDetection] = useState(false);
  const [showObjectDetection, setShowObjectDetection] = useState(false);

  const toggleSmartFeatures = () => {
    const newValue = !isSmartFeatureEnabled;
    setIsSmartFeatureEnabled(newValue);
    if (newValue) {
      // Initialize with AI-optimized settings
      const optimizedSettings = {
        focusMode: 'continuous',
        exposureMode: 'auto',
        whiteBalance: { temperature: 6500, offset: 0 },
        iso: 400,
        shutterSpeed: 100,
        aperture: 2.8,
        sceneMode: 'auto',
        burstMode: 'single',
        focusDistance: 5.0,
        stabilization: true,
        faceDetection: true,
        faceTracking: true,
        objectDetection: true
      };
      applyAIOptimizedSettings(optimizedSettings);
    }
  };

  const handleSceneDetection = async () => {
    const mockImage = 'sample-image-url';
    const detected = await detectScene(mockImage);
    setShowSceneDetection(true);
  };

  const handleFaceDetection = async () => {
    const mockImage = 'sample-image-url';
    const detectedFaces = await detectFaces(mockImage);
    setShowFaceDetection(true);
  };

  const handleObjectDetection = async () => {
    const mockImage = 'sample-image-url';
    const detectedObjects = await detectObjects(mockImage);
    setShowObjectDetection(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Advanced AI Camera</Text>
      <Text style={styles.sceneInfo}>Current Scene: {currentScene}</Text>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Smart Features: {isSmartFeatureEnabled ? 'ON' : 'OFF'}</Text>
          <Text style={styles.statusText}>Detected Faces: {faces.length}</Text>
          <Text style={styles.statusText}>Detected Objects: {detectedObjects.length}</Text>
          <Text style={styles.statusText}>ISO: {settings.iso || 'N/A'}</Text>
          <Text style={styles.statusText}>Shutter: {settings.shutterSpeed || 'N/A'}s</Text>
          <Text style={styles.statusText}>Aperture: {settings.aperture || 'N/A'}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.featureButton, isSmartFeatureEnabled && styles.featureButtonActive]}
            onPress={toggleSmartFeatures}
          >
            <Text style={styles.buttonText}>Toggle Smart Features</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureButton}
            onPress={handleSceneDetection}
          >
            <Text style={styles.buttonText}>Detect Scene</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureButton}
            onPress={handleFaceDetection}
          >
            <Text style={styles.buttonText}>Detect Faces</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureButton}
            onPress={handleObjectDetection}
          >
            <Text style={styles.buttonText}>Detect Objects</Text>
          </TouchableOpacity>
        </View>

        {showSceneDetection && (
          <View style={styles.detectionResult}>
            <Text style={styles.resultText}>Scene detected: {currentScene}</Text>
            <TouchableOpacity
              style={styles.applySceneSettings}
              onPress={() => setSettings({...settings, sceneMode: currentScene as any})}
            >
              <Text style={styles.buttonText}>Apply Scene Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {showFaceDetection && (
          <View style={styles.detectionResult}>
            <Text style={styles.resultText}>Faces detected: {faces.length}</Text>
            {faces.map((face) => (
              <Text key={face.id} style={styles.faceText}>Face {face.id} at ({face.position.x}, {face.position.y}) - {face.confidence}</Text>
            ))}
          </View>
        )}

        {showObjectDetection && (
          <View style={styles.detectionResult}>
            <Text style={styles.resultText}>Objects detected: {detectedObjects.length}</Text>
            {detectedObjects.map((obj, index) => (
              <Text key={index} style={styles.objectText}>- {obj.type}: {obj.name} ({obj.confidence})</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10
  },
  sceneInfo: {
    fontSize: 16,
    color: '#00ff00',
    marginBottom: 20
  },
  scrollContainer: {
    flex: 1
  },
  statusContainer: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12
  },
  featureButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  featureButtonActive: {
    backgroundColor: '#34C759'
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  detectionResult: {
    backgroundColor: '#444',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15
  },
  resultText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10
  },
  faceText: {
    color: '#FFA500',
    fontSize: 14,
    marginBottom: 4
  },
  objectText: {
    color: '#00FFFF',
    fontSize: 14,
    marginBottom: 4
  },
  applySceneSettings: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10
  }
});
