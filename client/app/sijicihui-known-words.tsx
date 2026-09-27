import SijicihuiCategoryList from '@/screens/sijicihui-category';

export default function SijicihuiKnownWords() {
  return (
    <SijicihuiCategoryList
      status="known"
      title="已会单词"
      color="#4CAF50"
      emptyText="暂无已会单词"
      hint="拖动单词到已会分类"
    />
  );
}