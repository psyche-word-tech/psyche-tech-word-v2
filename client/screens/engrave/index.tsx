import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useState } from 'react';

const iconRock = require('@/assets/rock.jpg');

export default function EngraveScreen() {
  const router = useSafeRouter();
  const [text, setText] = useState('');

  return (
    <Screen>
      <View style={styles.container}>
        {/* Top Image */}
        <Image source={iconRock} style={styles.topImage} resizeMode="cover" />

        {/* Content */}
        <View style={styles.content}>
          {/* Dialog */}
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>请输入你想刻的字</Text>
            
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor="#999999"
              value={text}
              onChangeText={setText}
              multiline
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.confirmBtn}
                onPress={() => {
                  if (text.trim()) {
                    router.replace('/study', { engravedText: text.trim() });
                  } else {
                    router.back();
                  }
                }}
              >
                <Text style={styles.confirmText}>确定</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.undoBtn}
                onPress={() => {
                  setText('');
                  router.replace('/study', { engravedText: '' });
                }}
              >
                <Text style={styles.undoText}>撤销</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom Action Area */}
        <View style={styles.bottomAction}>
          <TouchableOpacity 
            style={styles.settingsButton} 
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color="#333333" />
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topImage: {
    width: '100%',
    height: 150,
  },
  content: {
    flex: 1,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',

    padding: 20,
  },
  dialogTitle: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {

    minHeight: 100,
    padding: 12,
    fontSize: 14,
    fontFamily: 'serif',
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginTop: 20,
  },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#000000',
  },
  confirmText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'serif',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,

  },
  cancelText: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'serif',
  },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,

  },
  undoText: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'serif',
  },
  bottomAction: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#F5F5F5',
  },
  settingsButton: {
    padding: 10,
    backgroundColor: '#F5F5F5',
  },
});
