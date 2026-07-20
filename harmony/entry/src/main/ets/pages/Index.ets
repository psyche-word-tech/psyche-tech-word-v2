import { webview } from '@kit.ArkWeb';

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  @State webUrl: string = 'http://82.157.60.179:5000';
  @State isLoading: boolean = true;
  @State canGoBack: boolean = false;
  @State loadError: boolean = false;

  aboutToAppear() {
    try {
      webview.WebviewController.setWebDebuggingAccess(true);
      // 每次启动加时间戳，绕过缓存加载最新内容
      this.webUrl = 'http://82.157.60.179:5000?t=' + Date.now();
    } catch (e) {
      console.error('WebView init error:', JSON.stringify(e));
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Web({ src: this.webUrl, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .cacheMode(CacheMode.None)
        .onPageBegin(() => {
          this.isLoading = true;
          this.loadError = false;
        })
        .onPageEnd(() => {
          this.isLoading = false;
          this.canGoBack = this.controller.accessBackward();
        })
        .onErrorReceive((error) => {
          console.error('WebView error:', error.error.getErrorInfo());
          this.loadError = true;
        })
        .backgroundColor($r('app.color.start_window_background'))

      if (this.isLoading) {
        Column() {
          LoadingProgress()
            .width(48)
            .height(48)
            .color($r('sys.color.brand'))
          Text('psyche tech')
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor($r('sys.color.font_primary'))
            .margin({ top: 16 })
          Text('加载中...')
            .fontSize(14)
            .fontColor($r('sys.color.font_secondary'))
            .margin({ top: 8 })
        }
        .width('100%')
        .height('100%')
        .backgroundColor($r('app.color.start_window_background'))
        .justifyContent(FlexAlign.Center)
      }

      if (this.loadError) {
        Column() {
          Text('加载失败')
            .fontSize(18)
            .fontColor('#ff4444')
          Text('请检查网络连接')
            .fontSize(14)
            .fontColor($r('sys.color.font_secondary'))
            .margin({ top: 8 })
          Button('重新加载')
            .margin({ top: 20 })
            .onClick(() => {
              this.loadError = false;
              this.controller.loadUrl(this.webUrl);
            })
        }
        .width('100%')
        .height('100%')
        .backgroundColor($r('app.color.start_window_background'))
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.getStatusBarHeight() })
  }

  getStatusBarHeight(): number {
    try {
      return AppStorage.get<number>('statusBarHeight') ?? 0;
    } catch (e) {
      return 0;
    }
  }
}
