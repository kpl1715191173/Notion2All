import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import PostCard from '@/components/PostCard';

export default async function Home() {
  const posts = await getAllPosts();
  
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">我的 Notion 博客</h1>
        <p className="text-xl text-gray-600">
          使用 Notion2All 从 Notion 自动生成的博客
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))
        ) : (
          <div className="col-span-full text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-700">暂无文章</h2>
            <p className="mt-2 text-gray-500">
              请先从 Notion 同步内容或配置数据源。
            </p>
          </div>
        )}
      </div>
    </main>
  );
} 