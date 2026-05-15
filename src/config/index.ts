import { AppConfig } from './types';
import * as path from 'path';
import * as fs from 'fs';

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function resolveEnvVars(config: AppConfig): AppConfig {
  const envMap: Record<string, string> = {
    openai: process.env.OPENAI_API_KEY || '',
    qwen: process.env.QWEN_API_KEY || '',
  };

  const llm = { ...config.llm };
  const options = { ...llm.options };

  const apiKey = envMap[llm.provider];
  if (apiKey) {
    options.apiKey = apiKey;
  }

  llm.options = options;
  return { ...config, llm };
}

// 运行时配置引用（用于 Web 面板读取和修改）
let runtimeConfig: AppConfig;

export function loadConfig(): AppConfig {
  // 1. 加载默认配置
  const defaultPath = path.resolve(__dirname, '../../config/default.json');
  if (!fs.existsSync(defaultPath)) {
    throw new Error(`默认配置文件不存在: ${defaultPath}`);
  }
  let config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8')) as AppConfig;

  // 2. 合并生产配置（如果存在）
  const prodPath = path.resolve(__dirname, '../../config/production.json');
  if (fs.existsSync(prodPath)) {
    const prodConfig = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      prodConfig
    ) as unknown as AppConfig;
  }

  // 3. 解析环境变量中的 API 密钥
  config = resolveEnvVars(config);

  // 4. 如果设置了环境变量，覆盖下载器 API URL
  if (process.env.DOWNLOADER_API_URL) {
    config.downloader = { ...config.downloader, apiUrl: process.env.DOWNLOADER_API_URL };
  }

  runtimeConfig = config;
  return config;
}

/**
 * 获取当前运行时配置（Web 面板用，不含敏感密钥）
 */
export function getRuntimeConfig(): AppConfig {
  return runtimeConfig;
}

/**
 * 更新运行时配置并持久化到 config/production.json
 * @param update 要更新的配置字段（部分配置）
 */
export function updateRuntimeConfig(update: Partial<AppConfig>): AppConfig {
  runtimeConfig = deepMerge(
    runtimeConfig as unknown as Record<string, unknown>,
    update as unknown as Record<string, unknown>
  ) as unknown as AppConfig;

  // 持久化到 production.json（不包含环境变量中的密钥）
  const prodPath = path.resolve(__dirname, '../../config/production.json');
  const toSave = {
    ...runtimeConfig,
    llm: {
      ...runtimeConfig.llm,
      options: { ...runtimeConfig.llm.options },
    },
  };
  // 移除运行时注入的 API 密钥，避免写入文件
  if (toSave.llm.options.apiKey) {
    delete toSave.llm.options.apiKey;
  }

  try {
    fs.writeFileSync(prodPath, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (err) {
    throw new Error(`保存配置文件失败: ${(err as Error).message}`);
  }

  return runtimeConfig;
}
