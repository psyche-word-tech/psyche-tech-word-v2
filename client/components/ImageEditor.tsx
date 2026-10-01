import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { manipulateAsync } from 'expo-image-manipulator';

interface Props {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onApply: (newUri: string) => void;
}

const BOX_W = 320;
const BOX_H = 400;
const MIN_CROP = 40;

type CropRect = { x: number; y: number; w: number; h: number };
type DragMode = 'move' | 'tl' | 'tr' | 'bl' | 'br';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function ImageEditor({ visible, imageUri, onClose, onApply }: Props) {
  const [workUri, setWorkUri] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: BOX_W, h: BOX_H });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && imageUri) {
      setWorkUri(imageUri);
      setCrop({ x: 0, y: 0, w: BOX_W, h: BOX_H });
    }
  }, [visible, imageUri]);

  useEffect(() => {
    if (workUri) {
      Image.getSize(workUri, (w, h) => setNatural({ w, h }), () => setNatural({ w: 0, h: 0 }));
    }
  }, [workUri]);

  const scale = natural.w && natural.h ? Math.min(BOX_W / natural.w, BOX_H / natural.h) : 1;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;
  const offX = (BOX_W - dispW) / 2;
  const offY = (BOX_H - dispH) / 2;

  const dragRef = useRef({ sx: 0, sy: 0, orig: { x: 0, y: 0, w: BOX_W, h: BOX_H } as CropRect });

  const makeResponder = (mode: DragMode) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragRef.current = {
          sx: e.nativeEvent.pageX,
          sy: e.nativeEvent.pageY,
          orig: { ...crop },
        };
      },
      onPanResponderMove: (e) => {
        const dx = e.nativeEvent.pageX - dragRef.current.sx;
        const dy = e.nativeEvent.pageY - dragRef.current.sy;
        const o = dragRef.current.orig;
        let { x, y, w, h } = o;
        if (mode === 'move') {
          x = clamp(o.x + dx, 0, BOX_W - o.w);
          y = clamp(o.y + dy, 0, BOX_H - o.h);
        } else if (mode === 'br') {
          w = clamp(o.w + dx, MIN_CROP, BOX_W - o.x);
          h = clamp(o.h + dy, MIN_CROP, BOX_H - o.y);
        } else if (mode === 'tl') {
          x = clamp(o.x + dx, 0, o.x + o.w - MIN_CROP);
          y = clamp(o.y + dy, 0, o.y + o.h - MIN_CROP);
          w = o.w - (x - o.x);
          h = o.h - (y - o.y);
        } else if (mode === 'tr') {
          y = clamp(o.y + dy, 0, o.y + o.h - MIN_CROP);
          w = clamp(o.w + dx, MIN_CROP, BOX_W - o.x);
          h = o.h - (y - o.y);
        } else if (mode === 'bl') {
          x = clamp(o.x + dx, 0, o.x + o.w - MIN_CROP);
          w = o.w - (x - o.x);
          h = clamp(o.h + dy, MIN_CROP, BOX_H - o.y);
        }
        setCrop({ x, y, w, h });
      },
    });

  const moveResp = useRef(makeResponder('move'));
  const tlResp = useRef(makeResponder('tl'));
  const trResp = useRef(makeResponder('tr'));
  const blResp = useRef(makeResponder('bl'));
  const brResp = useRef(makeResponder('br'));

  const toDataUri = (r: { uri: string; base64?: string }) =>
    r.base64 ? `data:image/jpeg;base64,${r.base64}` : r.uri;

  const rotate = async (deg: 90 | -90) => {
    if (!workUri || busy) return;
    setBusy(true);
    try {
      const r = await manipulateAsync(workUri, [{ rotate: deg }], { compress: 0.9, base64: true });
      setWorkUri(toDataUri(r));
      setCrop({ x: 0, y: 0, w: BOX_W, h: BOX_H });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (!workUri || !natural.w || busy) return;
    const ix = Math.max(crop.x, offX);
    const iy = Math.max(crop.y, offY);
    const ix2 = Math.min(crop.x + crop.w, offX + dispW);
    const iy2 = Math.min(crop.y + crop.h, offY + dispH);
    const cw = ix2 - ix;
    const ch = iy2 - iy;
    if (cw < 8 || ch < 8) return;
    const nx = Math.round((ix - offX) / scale);
    const ny = Math.round((iy - offY) / scale);
    const nw = Math.max(1, Math.round(cw / scale));
    const nh = Math.max(1, Math.round(ch / scale));
    setBusy(true);
    try {
      const r = await manipulateAsync(
        workUri,
        [{ crop: { originX: nx, originY: ny, width: nw, height: nh } }],
        { compress: 0.9, base64: true },
      );
      setWorkUri(toDataUri(r));
      setCrop({ x: 0, y: 0, w: BOX_W, h: BOX_H });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (workUri) onApply(workUri);
  };

  const handleSize = 22;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>裁剪 / 旋转</Text>

          <View style={[styles.box, { width: BOX_W, height: BOX_H }]}>
            {workUri ? (
              <Image
                source={{ uri: workUri }}
                style={{ width: BOX_W, height: BOX_H }}
                resizeMode="contain"
              />
            ) : null}

            {/* 裁剪框 */}
            <View
              style={[styles.cropBox, { left: crop.x, top: crop.y, width: crop.w, height: crop.h }]}
              {...moveResp.current.panHandlers}
            >
              <View style={[styles.handle, styles.handleTl, { width: handleSize, height: handleSize }]} {...tlResp.current.panHandlers} />
              <View style={[styles.handle, styles.handleTr, { width: handleSize, height: handleSize }]} {...trResp.current.panHandlers} />
              <View style={[styles.handle, styles.handleBl, { width: handleSize, height: handleSize }]} {...blResp.current.panHandlers} />
              <View style={[styles.handle, styles.handleBr, { width: handleSize, height: handleSize }]} {...brResp.current.panHandlers} />
            </View>

            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => rotate(-90)} disabled={busy}>
              <Text style={styles.btnText}>⟲ 左转</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => rotate(90)} disabled={busy}>
              <Text style={styles.btnText}>⟳ 右转</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={applyCrop} disabled={busy}>
              <Text style={styles.btnText}>✂ 应用裁剪</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={[styles.btnText, { color: '#666' }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={confirm} disabled={busy}>
              <Text style={[styles.btnText, { color: '#fff' }]}>✓ 使用此图</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    maxWidth: 380,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: '#333' },
  box: { position: 'relative', backgroundColor: '#000', overflow: 'hidden' },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4da3ff',
    backgroundColor: 'transparent',
  },
  handle: { position: 'absolute', backgroundColor: 'rgba(77,163,255,0.9)', borderRadius: 4 },
  handleTl: { left: -10, top: -10 },
  handleTr: { right: -10, top: -10 },
  handleBl: { left: -10, bottom: -10 },
  handleBr: { right: -10, bottom: -10 },
  busy: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  row: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'center' },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  btnGhost: { backgroundColor: '#f2f2f2' },
  btnPrimary: { backgroundColor: '#10b981' },
  btnText: { fontSize: 14, fontWeight: '600', color: '#333' },
});
