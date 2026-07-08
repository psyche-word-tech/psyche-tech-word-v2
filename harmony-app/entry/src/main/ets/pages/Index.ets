import { webview } from '@kit.ArkWeb';

// ============================================================
// 配置前端页面地址
// 请将下面的 URL 替换为你的前端部署地址
// 例如 GitHub Pages: https://yourname.github.io/repo-name/
// 例如 Vercel: https://your-project.vercel.app/
// ============================================================
const FRONTEND_URL = 'https://word-voyage-web.vercel.app/';

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: FRONTEND_URL, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .databaseAccess(true)
        .fileAccess(true)
        .mixedMode(MixedMode.All)
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.getStatusBarHeight() })
  }

  getStatusBarHeight(): number {
    return 0;
  }
}
