/**
 * 创建 FormData 文件对象，用于文件上传
 * @param uri 文件本地 URI
 * @param name 文件名
 * @param type MIME 类型
 */
export function createFormDataFile(uri: string, name: string, type: string) {
  return {
    uri,
    name,
    type,
  } as any;
}
