# 万能下载器后端 API 文档

## 概述

万能下载器后端（universal-downloader-backend）是一个轻量级 Node.js 服务，用于解析抖音和哔哩哔哩的分享链接，获取作品详情，并提供代理下载功能。项目仅使用 Node.js 内置模块，无外部依赖。

- **基础 URL**: `http://{host}:{port}`（默认 `http://127.0.0.1:8787`）
- **支持平台**: 抖音（Douyin）、哔哩哔哩（Bilibili）
- **数据格式**: 所有 API 请求和响应均使用 JSON（下载文件接口除外）
- **字符编码**: UTF-8

---

## 通用约定

### 请求格式

- **Content-Type**: `application/json; charset=utf-8`
- **请求体限制**: 最大 1MB（超出返回 `413`）

### 成功响应格式

```json
{
  "success": true,
  "requestId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "data": { }
}
```

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误描述",
    "details": { }
  }
}
```

### 请求追踪

每个 API 响应均包含 `requestId` 字段（UUID v4），用于日志关联和问题排查。

---

## API 端点

### 1. 健康检查

```
GET /health
```

**描述**: 检查服务运行状态。

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "service": "universal-downloader-backend",
    "status": "ok",
    "now": "2026-05-15T12:00:00.000Z"
  }
}
```

---

### 2. 解析分享文本

```
POST /api/parse
```

**描述**: 解析用户复制的分享文本，提取平台类型、分享链接、作品 ID、标题等信息。支持短链展开和可选的元数据获取。

**请求体**:

| 字段 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `text` | `string` | **是** | - | 用户复制的分享文案（含分享链接） |
| `resolveRedirect` | `boolean` | 否 | `true` | 是否自动展开短链，追踪重定向 |
| `includeDebug` | `boolean` | 否 | `false` | 是否在响应中包含调试信息 |
| `fetchMetadata` | `boolean` | 否 | `false` | 是否同步获取作品元数据（会额外调用详情接口） |

**请求示例**:

```json
{
  "text": "6.12 复制打开抖音，看看【某某的作品】链接 https://v.douyin.com/xxxxx/ 8.97",
  "resolveRedirect": true,
  "fetchMetadata": true
}
```

**成功响应（200）**:

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "parseId": "parse_1684156800000_a1b2c3d4",
    "platform": "douyin",
    "type": "video",
    "status": "resolved",
    "input": {
      "rawText": "原始分享文本...",
      "shareCode": "8.97",
      "shareUrl": "https://v.douyin.com/xxxxx/"
    },
    "resolved": {
      "platform": "douyin",
      "finalUrl": "https://www.douyin.com/video/7123456789123456789",
      "resourceId": "7123456789123456789",
      "awemeId": "7123456789123456789",
      "bvid": "",
      "aid": "",
      "page": null,
      "title": "作品标题",
      "resourceTypeHint": "video"
    },
    "nextStep": "You can continue to fetch metadata or prepare a download.",
    "metadata": { }
  }
}
```

**字段说明**:

| 字段 | 描述 |
|------|------|
| `parseId` | 本次解析的唯一标识 |
| `platform` | 平台：`douyin` / `bilibili` |
| `type` | 资源类型：`video`（视频）、`note`（图文）、`video_or_note`（待确认）、`unknown` |
| `status` | 解析状态：`resolved`（已解析出ID）、`partial`（仅提取了URL） |
| `input.shareCode` | 抖音分享口令数字（仅抖音） |
| `input.shareUrl` | 从文本中提取的分享链接 |
| `resolved.resourceId` | 作品唯一标识（抖音为数字ID，B站为BVID或avid） |
| `resolved.awemeId` | 抖音作品 ID |
| `resolved.bvid` / `resolved.aid` | B站视频 ID |
| `resolved.page` | B站分P页码 |
| `resolved.resourceTypeHint` | 资源类型提示 |
| `metadata` | 仅在 `fetchMetadata=true` 时返回，结构与详情接口一致 |

**错误码**:

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| `EMPTY_TEXT` | 400 | 未提供分享文本 |
| `NO_URL_FOUND` | 400 | 文本中未发现 URL |
| `NO_SUPPORTED_URL` | 400 | 未找到支持的平台 URL |
| `UNSUPPORTED_PLATFORM` | 400 | 不支持的平台 |

---

### 3. 获取作品详情

```
POST /api/detail
```

**描述**: 根据作品 ID 获取完整的作品元数据，包括标题、描述、作者、封面、多清晰度视频源、图集图片等。

**请求体**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `platform` | `string` | 否 | 平台：`douyin` / `bilibili`（可自动推断） |
| `awemeId` | `string` | 条件必填 | 抖音作品 ID 或通用资源 ID |
| `resourceId` | `string` | 否 | `awemeId` 的备选字段 |
| `bvid` | `string` | 条件必填 | B站 BVID（如 `BV1xx411c7mD`） |
| `aid` | `string` | 条件必填 | B站 AVID（纯数字） |
| `page` | `number` | 否 | B站多P视频的页码（默认第1P） |
| `resolvedUrl` | `string` | 否 | 已解析的原始 URL（辅助推断） |
| `typeHint` | `string` | 否 | 资源类型提示：`video` / `note` |
| `includeDebug` | `boolean` | 否 | 是否包含调试信息（默认 `false`） |

> **注意**: 抖音需要提供 `awemeId`，B站需要提供 `bvid` 或 `aid`。

**请求示例**:

```json
{
  "platform": "douyin",
  "awemeId": "7123456789123456789"
}
```

```json
{
  "platform": "bilibili",
  "bvid": "BV1xx411c7mD",
  "page": 1
}
```

**成功响应（200）**:

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "platform": "douyin",
    "resourceId": "7123456789123456789",
    "awemeId": "7123456789123456789",
    "bvid": "",
    "aid": "",
    "page": null,
    "part": "",
    "pagesCount": 1,
    "mediaType": "video",
    "title": "作品标题",
    "description": "作品描述",
    "author": {
      "uid": "123456789",
      "secUid": "MS4wLj...",
      "nickname": "作者昵称",
      "avatar": "https://example.com/avatar.jpg"
    },
    "cover": "https://example.com/cover.jpg",
    "durationMs": 15000,
    "statistics": {
      "commentCount": 100,
      "diggCount": 5000,
      "playCount": 100000,
      "shareCount": 200,
      "collectCount": 300
    },
    "sharePage": {
      "sourceUrl": "https://www.iesdouyin.com/share/video/7123456789123456789/",
      "pageUrl": "https://www.iesdouyin.com/share/video/7123456789123456789/"
    },
    "sources": [
      {
        "id": "wm_default",
        "kind": "video",
        "label": "Default source",
        "watermark": "with_watermark",
        "url": "https://example.com/video.mp4",
        "width": 1080,
        "height": 1920,
        "durationMs": 15000,
        "sizeBytes": 5242880,
        "videoId": "v0200fg10000..."
      },
      {
        "id": "bitrate_1",
        "kind": "video",
        "label": "720p 720x1280",
        "watermark": "unknown",
        "url": "https://example.com/video_720p.mp4",
        "width": 720,
        "height": 1280,
        "durationMs": 15000,
        "sizeBytes": 3145728,
        "bitRate": 1500000,
        "qualityType": 2,
        "isH265": false,
        "videoId": "v0200fg10000..."
      }
    ],
    "images": []
  }
}
```

**字段说明**:

| 字段 | 描述 |
|------|------|
| `mediaType` | 媒体类型：`video`（视频）/ `note`（图文笔记） |
| `pagesCount` | B站多P视频的总P数 |
| `part` | B站当前P的标题 |
| `durationMs` | 视频时长（毫秒） |
| `sources[]` | 视频下载源列表 |
| `sources[].id` | 源标识符，用于后续下载 `sourceId` 参数 |
| `sources[].watermark` | 水印状态：`with_watermark` / `without_watermark` / `unknown` |
| `sources[].bitRate` | 码率（bps），仅抖音多码率源 |
| `sources[].isH265` | 是否为 H.265 编码 |
| `images[]` | 图文笔记的图片列表（仅 `mediaType=note` 时有效） |
| `images[].id` | 图片标识符，用于后续下载 `imageId` 参数 |
| `images[].url` | 图片展示 URL |
| `images[].downloadUrl` | 图片下载 URL |

**错误码**:

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| `MISSING_AWEME_ID` | 400 | 缺少抖音作品 ID |
| `MISSING_BILIBILI_ID` | 400 | 缺少 B站视频 ID |
| `UNSUPPORTED_PLATFORM` | 400 | 不支持的平台 |
| `UPSTREAM_FETCH_FAILED` | 502 | 上游数据获取失败 |
| `CONTENT_UNAVAILABLE` | 404 | 内容不可用（已删除/权限不足） |
| `ROUTER_DATA_NOT_FOUND` | 502 | 页面中未找到作品数据 |
| `ROUTER_DATA_INVALID` | 502 | 作品数据解析失败 |
| `DETAIL_FETCH_FAILED` | 502 | 详情获取失败 |
| `BILIBILI_VIEW_FAILED` | 502 | B站 view 接口失败 |
| `BILIBILI_PLAYURL_FAILED` | 502 | B站 playurl 接口失败 |
| `BILIBILI_MP4_NOT_FOUND` | 502 | B站未返回 HTML5 MP4 源 |

---

### 4. 准备下载（生成下载票据）

```
POST /api/download/prepare
```

**描述**: 为指定的视频源或图片生成一个临时下载票据。票据有效期默认 10 分钟，过期后需重新获取。该接口会先调用详情接口获取作品数据，再生成票据。

**请求体**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `platform` | `string` | 否 | 平台：`douyin` / `bilibili` |
| `awemeId` | `string` | 条件必填 | 抖音作品 ID 或通用资源 ID |
| `resourceId` | `string` | 否 | `awemeId` 的备选字段 |
| `bvid` | `string` | 条件必填 | B站 BVID |
| `aid` | `string` | 条件必填 | B站 AVID |
| `page` | `number` | 否 | B站多P页码 |
| `resolvedUrl` | `string` | 否 | 已解析 URL |
| `typeHint` | `string` | 否 | 资源类型提示：`video` / `note` |
| `sourceId` | `string` | 否 | 选定的视频源 ID（不传则使用第一个源） |
| `imageId` | `string` | 否 | 选定的图片 ID（不传则使用第一张图） |

**请求示例**:

```json
{
  "platform": "douyin",
  "awemeId": "7123456789123456789",
  "sourceId": "wm_default"
}
```

**成功响应（200）**:

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "data": {
    "ticket": "dl_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "platform": "douyin",
    "resourceId": "7123456789123456789",
    "awemeId": "7123456789123456789",
    "bvid": "",
    "aid": "",
    "page": null,
    "mediaType": "video",
    "assetType": "video",
    "assetId": "wm_default",
    "fileName": "作品标题-Default source.mp4",
    "expiresAt": 1684157400000,
    "downloadUrl": "http://127.0.0.1:8787/api/download/file/dl_xxxx",
    "source": {
      "label": "Default source",
      "contentTypeHint": "video/mp4"
    }
  }
}
```

**字段说明**:

| 字段 | 描述 |
|------|------|
| `ticket` | 下载票据，格式为 `dl_` + 32位十六进制 |
| `assetType` | 资源类型：`video` / `image` |
| `assetId` | 选定的视频源 ID 或图片 ID |
| `fileName` | 建议的下载文件名 |
| `expiresAt` | 票据过期时间（Unix 毫秒时间戳，默认 10 分钟后过期） |
| `downloadUrl` | 实际下载链接 |
| `source.label` | 源标签（如清晰度） |
| `source.contentTypeHint` | 内容类型提示 |

**错误码**:

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| `SOURCE_NOT_FOUND` | 404 | 指定的视频源不存在 |
| `SOURCE_URL_MISSING` | 502 | 视频源缺少下载 URL |
| `IMAGE_NOT_FOUND` | 404 | 指定的图片不存在 |
| `IMAGE_URL_MISSING` | 502 | 图片缺少下载 URL |

---

### 5. 下载文件

```
GET /api/download/file/{ticket}
```

**描述**: 通过票据代理下载实际文件。服务端会携带必要的 Referer 和 UA 请求上游，以流式方式转发文件内容。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `ticket` | `string` | 从 `/api/download/prepare` 获取的下载票据 |

**请求示例**:

```bash
curl -o output.mp4 "http://127.0.0.1:8787/api/download/file/dl_a1b2c3d4e5f6g7h8"
```

**成功响应（200）**:

- `Content-Type`: 上游实际 Content-Type 或 `contentTypeHint`
- `Content-Disposition`: `attachment; filename*=UTF-8''<URL编码的文件名>`
- `Content-Length`: 上游原始文件大小（如上游提供）
- `Cache-Control`: `no-store`
- `X-Download-Ticket`: 对应的票据值

响应体为原始文件二进制流。

**错误码**:

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| `TICKET_NOT_FOUND` | 404 | 票据不存在 |
| `TICKET_EXPIRED` | 410 | 票据已过期（需重新调用 prepare） |
| `DOWNLOAD_UPSTREAM_FAILED` | 502 | 上游下载 URL 不可用 |

---

### 6. 静态文件服务

```
GET /
GET /index.html
GET /styles.css
GET /app.js
```

**描述**: 提供调试用前端页面及静态资源。目录遍历攻击已做路径校验防护。

---

## 错误码速查表

| 错误码 | HTTP 状态码 | 来源接口 | 描述 |
|--------|------------|----------|------|
| `EMPTY_TEXT` | 400 | `/api/parse` | 未提供分享文本 |
| `NO_URL_FOUND` | 400 | `/api/parse` | 文本中未发现 URL |
| `NO_SUPPORTED_URL` | 400 | `/api/parse` | 未找到支持的平台 URL |
| `UNSUPPORTED_PLATFORM` | 400 | `/api/parse`, `/api/detail` | 不支持的平台 |
| `MISSING_AWEME_ID` | 400 | `/api/detail` | 缺少抖音作品 ID |
| `MISSING_BILIBILI_ID` | 400 | `/api/detail` | 缺少 B站视频 ID |
| `UPSTREAM_FETCH_FAILED` | 502 | `/api/detail` | 上游页面请求失败 |
| `CONTENT_UNAVAILABLE` | 404 | `/api/detail` | 内容不可用 |
| `ROUTER_DATA_NOT_FOUND` | 502 | `/api/detail` | 页面数据提取失败 |
| `ROUTER_DATA_INVALID` | 502 | `/api/detail` | 页面数据解析失败 |
| `DETAIL_FETCH_FAILED` | 502 | `/api/detail` | 详情获取失败 |
| `BILIBILI_VIEW_FAILED` | 502 | `/api/detail` | B站 view API 失败 |
| `BILIBILI_PLAYURL_FAILED` | 502 | `/api/detail` | B站 playurl API 失败 |
| `BILIBILI_MP4_NOT_FOUND` | 502 | `/api/detail` | B站无 MP4 直链 |
| `SOURCE_NOT_FOUND` | 404 | `/api/download/prepare` | 视频源不存在 |
| `SOURCE_URL_MISSING` | 502 | `/api/download/prepare` | 视频源无下载 URL |
| `IMAGE_NOT_FOUND` | 404 | `/api/download/prepare` | 图片不存在 |
| `IMAGE_URL_MISSING` | 502 | `/api/download/prepare` | 图片无下载 URL |
| `TICKET_NOT_FOUND` | 404 | `/api/download/file` | 票据不存在 |
| `TICKET_EXPIRED` | 410 | `/api/download/file` | 票据已过期 |
| `DOWNLOAD_UPSTREAM_FAILED` | 502 | `/api/download/file` | 上游下载失败 |
| `PAYLOAD_TOO_LARGE` | 413 | 所有 | 请求体超过 1MB |
| `INVALID_JSON` | 400 | 所有 | JSON 格式不合法 |
| `NOT_FOUND` | 404 | 所有 | 路由不存在 |
| `INTERNAL_SERVER_ERROR` | 500 | 所有 | 服务器内部错误 |

---

## 环境配置

配置文件：`.env`（项目根目录）

| 变量 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `HOST` | `string` | `0.0.0.0` | 服务监听地址 |
| `PORT` | `number` | `8787` | 服务监听端口 |
| `PUBLIC_BASE_URL` | `string` | `http://127.0.0.1:8787` | 公网访问地址，用于生成下载链接 |

---

## 调用流程示例

### 典型流程：从分享文本到下载文件

```bash
# 步骤 1: 解析分享文本
curl -X POST http://127.0.0.1:8787/api/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"6.12 复制打开抖音 https://v.douyin.com/xxxxx/ 8.97"}'

# 步骤 2: 获取作品详情（可选，parse 时可设置 fetchMetadata=true 跳过此步）
curl -X POST http://127.0.0.1:8787/api/detail \
  -H "Content-Type: application/json" \
  -d '{"platform":"douyin","awemeId":"7123456789123456789"}'

# 步骤 3: 生成下载票据
curl -X POST http://127.0.0.1:8787/api/download/prepare \
  -H "Content-Type: application/json" \
  -d '{"platform":"douyin","awemeId":"7123456789123456789","sourceId":"wm_default"}'

# 步骤 4: 下载文件
curl -o video.mp4 "http://127.0.0.1:8787/api/download/file/dl_xxxx"
```

### 图文笔记下载

```bash
# 生成图片下载票据
curl -X POST http://127.0.0.1:8787/api/download/prepare \
  -H "Content-Type: application/json" \
  -d '{"platform":"douyin","awemeId":"7123456789123456789","imageId":"image_1"}'

# 下载图片
curl -o image.jpg "http://127.0.0.1:8787/api/download/file/dl_xxxx"
```

---

## 技术说明

- **Node.js 版本要求**: >= 20
- **运行环境**: 无外部依赖，仅使用 `node:http`、`node:crypto`、`node:fs`、`node:path`、`node:stream` 内置模块
- **启动命令**: `npm start` → `node src/server.js`
- **票据存储**: 内存 Map，服务重启后所有票据失效
- **票据有效期**: 10 分钟（代码中硬编码，可通过 `DEFAULT_TICKET_TTL_MS` 常量修改）
- **日志格式**: JSON 结构化日志，通过 `console.log/warn/error` 输出
