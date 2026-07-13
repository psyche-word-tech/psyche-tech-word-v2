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
    webview.WebviewController.setWebDebuggingAccess(true);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Web({ src: this.webUrl, controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .cacheMode(CacheMode.CacheFirst)
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
        .backgroundColor('#ffffff')

      if (this.isLoading) {
        Column() {
          LoadingProgress()
            .width(48)
            .height(48)
            .color('#007AFF')
          Text('psyche tech')
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor('#333333')
            .margin({ top: 16 })
          Text('加载中...')
            .fontSize(14)
            .fontColor('#999999')
            .margin({ top: 8 })
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#ffffff')
        .justifyContent(FlexAlign.Center)
      }

      if (this.loadError) {
        Column() {
          Text('加载失败')
            .fontSize(18)
            .fontColor('#ff4444')
          Text('请检查网络连接')
            .fontSize(14)
            .fontColor('#999999')
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
        .backgroundColor('#ffffff')
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.getStatusBarHeight() })
  }

  getStatusBarHeight(): number {
    return AppStorage.get<number>('statusBarHeight') ?? 0;
  }
}
