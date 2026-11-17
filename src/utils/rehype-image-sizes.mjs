/**
 * 為 Markdown 文章裡的圖片加上 sizes 屬性。
 *
 * 文章內容欄寬最多 760px（.blog-post），預設的 sizes 會以原圖寬度（約 2000px）計算，
 * 讓瀏覽器挑太大的圖。告訴瀏覽器實際顯示寬度後，才會挑 srcset 裡合適的尺寸。
 */
const SIZES = '(min-width: 820px) 760px, 100vw';

export default function rehypeImageSizes() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'img') {
        node.properties ??= {};
        node.properties.sizes ??= SIZES;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
