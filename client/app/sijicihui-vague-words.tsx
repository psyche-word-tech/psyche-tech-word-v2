import SijicihuiCategoryList from '@/screens/sijicihui-category';

export default function SijicihuiVagueWords() {
  return (
    <SijicihuiCategoryList
      status="vague"
      title="模糊单词"
      color="#FF9800"
      emptyText="暂无模糊单词"
      hint="拖动单词到模糊分类"
    />
  );
}