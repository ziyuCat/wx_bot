import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger';

const DEVICE_FILE = path.resolve(__dirname, '../../.device.json');

interface DeviceData {
  deviceId: string;
  createdAt: string;
}

function generateDeviceId(): string {
  // wechat4u format: 'e' + 14 random hex characters
  return 'e' + crypto.randomBytes(7).toString('hex');
}

function loadDeviceData(): DeviceData | null {
  try {
    if (fs.existsSync(DEVICE_FILE)) {
      const raw = fs.readFileSync(DEVICE_FILE, 'utf-8');
      const data = JSON.parse(raw) as DeviceData;
      if (data.deviceId && data.deviceId.length === 15) {
        return data;
      }
    }
  } catch (err) {
    logger.warn('加载设备 ID 文件失败，将生成新的:', (err as Error).message);
  }
  return null;
}

function saveDeviceData(data: DeviceData): void {
  try {
    fs.writeFileSync(DEVICE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`设备 ID 已保存到 ${DEVICE_FILE}`);
  } catch (err) {
    logger.error('保存设备 ID 文件失败:', (err as Error).message);
  }
}

/**
 * Get or create a persistent device ID.
 * This ensures WeChat sees the same device on every login,
 * avoiding "new device login" prompts.
 */
export function getDeviceId(): string {
  const existing = loadDeviceData();
  if (existing) {
    logger.info(`加载已有设备 ID (创建于: ${existing.createdAt})`);
    return existing.deviceId;
  }

  const data: DeviceData = {
    deviceId: generateDeviceId(),
    createdAt: new Date().toISOString(),
  };

  saveDeviceData(data);
  logger.info('已生成新的持久化设备 ID');
  return data.deviceId;
}
