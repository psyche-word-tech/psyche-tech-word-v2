import { webview } from '@kit.ArkWeb';

@Entry
@Component
struct Index {
  // WebView 控制器
  controller: webview.WebviewController = new webview.WebviewController();

  // 要加载的 URL（线上地址或本地地址）
  // 线上：使用部署后的前端地址
  @State webUrl: string = 'http://82.157.60.179:5000';

  // 是否显示加载中
  @State isLoading: boolean = true;

  // 是否可以返回
  @State canGoBack: boolean = false;

  aboutToAppear() {
    // 允许明文 HTTP 传输（开发调试使用，正式发布建议用 HTTPS）
    webview.WebviewController.setWebDebuggingAccess(true);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // WebView 主组件
      Web({ src: this.webUrl, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .cacheMode(CacheMode.Default)
        .onPageBegin(() => {
          this.isLoading = true;
        })
        .onPageEnd(() => {
          this.isLoading = false;
          this.canGoBack = this.controller.accessBackward();
        })
        .onErrorReceive((error) => {
          console.error('WebView error:', error.error.getErrorInfo());
        })
        .backgroundColor('#ffffff')

      // 加载指示器
      if (this.isLoading) {
        LoadingProgress()
          .width(40)
          .height(40)
          .color('#007AFF')
          .position({ x: '50%', y: '50%' })
          .markAnchor({ x: '50%', y: '50%' })
      }
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.getStatusBarHeight() })
  }

  // 获取状态栏高度，避免内容被状态栏遮挡
  getStatusBarHeight(): number {
    return AppStorage.get<number>('statusBarHeight') ?? 0;
  }
}
