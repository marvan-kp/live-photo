import { View, Text, TouchableOpacity, FlatList, Image } from 'react-native';
import { useCameraConnection } from '../../hooks/useCameraConnection';
import React, { useState } from 'react';

export default function CameraTab() {
  const {
    selectedCamera,
    setSelectedCamera,
    connectionStatus,
    previewStream,
    connect,
    disconnect,
    capturePhoto
  } = useCameraConnection();

  const [showCameraSelector, setShowCameraSelector] = useState(false);

  const cameraOptions = [
    { brand: 'Sony', icon: '� Sony' },
    { brand: 'Canon', icon: '� Canon' },
    { brand: 'Nikon', icon: '� Nikon' },
    { brand: 'Leica', icon: '� Leica' },
    { brand: 'OM System', icon: '� OM System' },
    { brand: 'Panasonic', icon: '� Panasonic' }
  ];

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#000' }}>
      {connectionStatus === 'disconnected' && (
        <TouchableOpacity
          style={{ padding: 16, alignItems: 'center' }}
          onPress={() => setShowCameraSelector(!showCameraSelector)}
        >
          <Text style={{ color: 'white', fontSize: 18, marginBottom: 8 }}>
            Camera Brand: {selectedCamera?.brand}
          </Text>
        </TouchableOpacity>

        {showCameraSelector && (
          <FlatList
            data={cameraOptions}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ padding: 12, borderWidth: 1, borderColor: '#ccc', margin: 4 }}
                onPress={() => {
                  setSelectedCamera({ brand: item.brand });
                  setShowCameraSelector(false);
                }}
              >
                <Text style={{ color: 'white' }}>{item.icon} {item.brand}</Text>
              </TouchableOpacity>
            )}
            horizontal={false}
          />
        )}
      )}

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 16, marginBottom: 16 }}>
          Status: {connectionStatus}
        </Text>
        {previewStream && (
          <Image
            source={{ uri: previewStream }}
            style={{ width: '100%', height: 300, marginBottom: 16 }}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 16 }}>
        <TouchableOpacity
          style={{ backgroundColor: '#007AFF', padding: 16, borderRadius: 8 }}
          onPress={connect}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Connect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#FF3B30', padding: 16, borderRadius: 8 }}
          onPress={disconnect}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Disconnect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: '#34C759', padding: 16, borderRadius: 8 }}
          onPress={capturePhoto}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Capture</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
