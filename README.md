# 图片二选一投票

一个可部署到 Vercel 的 Next.js 图片二选一投票 MVP。

核心数据全部保存在 Supabase：

- `polls`：标题、A/B 标签、两张图片 URL、A/B 票数、创建时间
- `votes`：投票 ID、匿名浏览器 ID、选择项、投票时间
- `poll-images`：Supabase Storage 中的公开图片 bucket

项目不会使用 Vercel 或本机文件系统保存图片和票数。没有配置 Supabase
环境变量时，创建、读取和投票 API 会返回配置错误。

图片上传使用 Supabase signed upload URL：浏览器把压缩后的图片直接上传到
Supabase Storage，图片二进制不会经过 Vercel Function。

## 1. 创建 Supabase 项目

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)。
2. 点击 `New project`。
3. 选择组织，填写项目名称和数据库密码。
4. 选择离主要用户较近的 Region。
5. 点击 `Create new project`，等待初始化完成。

## 2. 创建数据库和 Storage bucket

1. 在 Supabase 左侧进入 `SQL Editor`。
2. 点击 `New query`。
3. 打开本项目的 `supabase/schema.sql`。
4. 将文件完整内容粘贴到 SQL Editor。
5. 点击 `Run`。

这段 SQL 会自动创建：

- `public.polls` 表
- `public.votes` 表
- 原子投票函数 `public.cast_poll_vote`
- 名为 `poll-images` 的 Storage bucket

bucket 配置：

- 名称：`poll-images`
- Public bucket：是
- 单文件限制：6 MB
- MIME 类型：`image/jpeg`

SQL 执行后，可在 `Storage` 页面确认 `poll-images` 已存在并显示为 public。
不需要再手动创建同名 bucket。如果 SQL 没有成功创建，才在 Storage 页面点击
`New bucket`，使用上述配置手动创建。

## 3. 获取 Supabase 环境变量

在 Supabase 项目中进入 `Project Settings`：

1. 在 `Data API` 或项目连接信息中找到 Project URL。
2. 在 `API Keys` 中找到公开的 `anon` key。
3. 在 `API Keys` 中找到服务端 `service_role` key。

本地新建 `.env.local`：

```text
SUPABASE_URL=https://你的项目引用.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://你的项目引用.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-anon-key
```

安全要求：

- `SUPABASE_SERVICE_ROLE_KEY` 只能放在服务器环境变量中。
- 不要添加 `NEXT_PUBLIC_` 前缀。
- 不要提交 `.env.local` 到 GitHub。
- 不要把 service role key 粘贴到浏览器代码或公开聊天中。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是 Supabase 设计为可公开使用的浏览器 key；
  它不能替代 service role key。

## 4. 本地安装和运行

项目要求 Node.js 20.9 或更高版本。

```powershell
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

如果当前 Codex 终端找不到 `npm`，本项目已安装依赖时可以运行：

```powershell
& 'C:\Users\代餐请离婚\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\next\dist\bin\next' dev
```

## 5. 本地验收

1. 上传两张图片并填写标题。
2. 点击“生成分享链接”。
3. 确认进入 `/p/xxxxxxxx`。
4. 点击图片 A 或 B。
5. 确认显示投票成功、票数和百分比。
6. 刷新页面，确认票数和已选择状态仍然存在。
7. 使用无痕窗口打开相同链接并投另一项。
8. 刷新两个窗口，确认看到同一组累计票数。
9. 在 Supabase `Table Editor` 中确认 `polls` 和 `votes` 有对应数据。
10. 在 Supabase `Storage` 中确认两张图片位于
    `poll-images/<poll-id>/`。

## 6. 推送到 GitHub

先在 [GitHub](https://github.com/new) 创建一个空仓库，不要初始化 README。

如果电脑尚未安装 Git，请先安装
[Git for Windows](https://git-scm.com/download/win)。

在项目目录运行：

```powershell
git init
git add .
git commit -m "Prepare image poll for production"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

提交前确认 `.env.local` 没有出现在 `git status` 中。

## 7. 部署到 Vercel

1. 打开 [Vercel](https://vercel.com/new) 并使用 GitHub 登录。
2. 点击 `Add New -> Project`。
3. 选择刚才的 GitHub 仓库并点击 `Import`。
4. Framework Preset 保持 `Next.js`。
5. 在 `Environment Variables` 添加：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

6. 两个变量都至少勾选 `Production`；建议同时勾选 `Preview`。
7. 点击 `Deploy`。

如果第一次部署时忘记添加变量，请在 Vercel 项目的
`Settings -> Environment Variables` 中添加，然后进入 `Deployments` 对最新部署
执行 `Redeploy`。环境变量变更不会自动应用到已完成的旧部署。

## 8. 公网验收

1. 打开 Vercel 提供的 `https://你的项目.vercel.app`。
2. 创建一个新投票。
3. 点击“复制分享链接”。
4. 确认链接类似：

```text
https://你的项目.vercel.app/p/xxxxxxxx
```

5. 将链接发到手机，关闭手机 Wi-Fi 后使用移动网络打开。
6. 在手机投 A，在电脑无痕窗口投 B。
7. 刷新页面，确认票数累计到同一结果。
8. 确认两台设备都能加载 Supabase Storage 图片。

分享地址由浏览器当前域名生成：

```ts
window.location.origin + "/p/" + pollId
```

代码中没有写死 `localhost`。

## 常见问题

### API 提示缺少 Supabase 环境变量

检查 `.env.local` 或 Vercel Environment Variables 是否同时包含
上述四个变量。修改后重启本地开发服务器或重新部署 Vercel。

### 图片上传提示 bucket 不存在

重新执行 `supabase/schema.sql`，并确认 Storage 中存在 public bucket：
`poll-images`。

### 投票提示数据库函数不存在

说明旧版表存在，但新版 SQL 没有完整执行。重新在 SQL Editor 中运行当前
`supabase/schema.sql`。

### 同一浏览器无法再次投票

这是当前产品设计。浏览器使用 `localStorage` 保存匿名访问者 ID 和已投选项，
数据库通过 `(poll_id, voter_id)` 唯一约束再次防止重复计票。清除浏览器数据会
生成新的匿名 ID，因此它不是登录级别的强防刷机制。

## 简单数据后台

后台地址：

```text
/admin
```

使用前需要：

1. 在 Supabase SQL Editor 执行：
   `supabase/migrations/20260622_add_page_views.sql`
2. 在本地 `.env.local` 和 Vercel Environment Variables 添加：

```text
ADMIN_PASSWORD=一个足够长且唯一的后台密码
```

后台提供：

- 总投票项目数
- 总投票次数
- 总访问次数
- 今日访问次数（按中国标准时间计算）
- 最近 10 个投票及分享链接

首页和有效投票详情页每次打开会向 `page_views` 插入一条记录。后台登录成功后
使用 12 小时有效的 HttpOnly cookie 保存会话，页面每 60 秒刷新一次统计。

## 官方参考

- [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Git Deployments](https://vercel.com/docs/git)
