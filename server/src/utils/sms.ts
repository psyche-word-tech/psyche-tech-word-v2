/**
 * 阿里云短信服务 (dysmsapi) - 短信验证码发送模块
 * 已安装: @alicloud/dysmsapi20170525
 *
 * 配置环境变量:
 * ALIBABA_CLOUD_ACCESS_KEY_ID=你的AccessKeyId
 * ALIBABA_CLOUD_ACCESS_KEY_SECRET=你的AccessKeySecret
 * ALIBABA_CLOUD_SMS_SIGN_NAME=你的签名
 * ALIBABA_CLOUD_SMS_TEMPLATE_CODE=你的模板ID
 */

import DysmsapiModule, * as DysmsapiTypes from '@alicloud/dysmsapi20170525';
import * as Util from '@alicloud/tea-util';

const DysmsapiClient = (DysmsapiModule as any).default as typeof DysmsapiModule;

function getClient() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
  return new (DysmsapiClient as any)({
    accessKeyId,
    accessKeySecret,
    endpoint: 'dysmsapi.aliyuncs.com',
  });
}

/**
 * 发送短信验证码
 * @param phone 手机号
 * @param code 验证码（6位数字）
 * @returns 成功时返回 { success: true }，失败时返回 { success: false, error: string }
 */
export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const sendRequest = new DysmsapiTypes.SendSmsRequest({
      phoneNumbers: phone,
      signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME,
      templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    });

    const runtime = new Util.RuntimeOptions({});
    const result = await client.sendSmsWithOptions(sendRequest, runtime);

    if (result.body?.code !== 'OK') {
      console.error('短信发送失败:', result.body?.code, result.body?.message);
      console.error('完整响应:', JSON.stringify(result.body));
      return { success: false, error: `${result.body?.code} - ${result.body?.message || '短信发送失败'}` };
    }

    console.log(`短信发送成功: ${phone}, bizId: ${result.body.bizId}`);
    return { success: true };
  } catch (error: any) {
    console.error('短信发送异常:', error);
    return { success: false, error: error.message || '短信发送异常' };
  }
}
