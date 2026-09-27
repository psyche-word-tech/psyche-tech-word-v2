import SijicihuiCategoryList from '@/screens/sijicihui-category';

export default function SijicihuiUnknownWords() {
  return (
    <SijicihuiCategoryList
      status="unknown"
      title="不会单词"
      color="#F44336"
      emptyText="暂无不会单词"
      hint="拖动单词到不会分类"
    />
  );
}