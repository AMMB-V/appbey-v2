import type { Router } from "express";
import { requireAuth, type AuthRequest } from "../auth.js";
import type { BladerDeck, CommunityPost, Notification, PostComment, PostLike, User } from "../models.js";

interface CommunityData {
  communityPosts: CommunityPost[];
  decks: BladerDeck[];
  notifications: Notification[];
  postComments: PostComment[];
  postLikes: PostLike[];
  users: User[];
}

interface CommunityState {
  getState: () => CommunityData;
  nextId: (records: readonly { id: number }[]) => number;
  publicUser: (user?: User | null) => object | null;
}

export function registerCommunityRoutes(api: Router, state: CommunityState): void {
  const { getState, nextId, publicUser } = state;

  api.get("/social/posts", (req: AuthRequest, res) => {
    const { communityPosts, decks, postComments, postLikes, users } = getState();
    const limit = parseInt((req.query.limit as string) || "30", 10);
    const currentUserId: number | null = req.user ? req.user.id : null;

    const list = [...communityPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
    res.json(
      list.map((post) => {
        const likesForPost = postLikes.filter((like) => like.post_id === post.id);
        const hasLiked = currentUserId ? likesForPost.some((like) => like.user_id === currentUserId) : false;
        return {
          ...post,
          likes_count: likesForPost.length,
          has_liked: hasLiked,
          user: publicUser(users.find((user) => user.id === post.user_id)),
          deck: decks.find((deck) => deck.id === post.deck_id),
          comments: postComments.filter((comment) => comment.post_id === post.id).map((comment) => ({
            ...comment,
            user: publicUser(users.find((user) => user.id === comment.user_id))
          }))
        };
      })
    );
  });

  api.post("/social/posts", requireAuth, (req: AuthRequest, res) => {
    const { communityPosts, decks } = getState();
    const { content, deck_id, image_url } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ detail: "El contenido de la publicación no puede estar vacío" });
      return;
    }
    const cleanContent = String(content).trim().slice(0, 1000);
    if (cleanContent.length < 3) {
      res.status(400).json({ detail: "La publicación debe tener al menos 3 caracteres" });
      return;
    }

    const recentUserPosts = communityPosts.filter((post) => post.user_id === req.user!.id);
    if (recentUserPosts.length > 0) {
      const latestPost = recentUserPosts[0];
      const diffMs = Date.now() - new Date(latestPost.created_at).getTime();
      if (diffMs < 3000) {
        res.status(429).json({ detail: "Por favor espera unos segundos antes de publicar de nuevo" });
        return;
      }
    }

    const newPost: CommunityPost = {
      id: nextId(communityPosts),
      user_id: req.user!.id,
      content: cleanContent,
      deck_id: deck_id ? parseInt(deck_id, 10) || null : null,
      image_url: image_url ? String(image_url).trim() : null,
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString()
    };
    communityPosts.unshift(newPost);
    res.json({
      ...newPost,
      has_liked: false,
      user: req.user,
      deck: decks.find((deck) => deck.id === newPost.deck_id),
      comments: []
    });
  });

  api.post("/social/posts/:id/like", requireAuth, (req: AuthRequest, res) => {
    const { communityPosts, postLikes } = getState();
    const id = parseInt(req.params.id, 10);
    const post = communityPosts.find((record) => record.id === id);
    if (!post) {
      res.status(404).json({ detail: "Publicación no encontrada" });
      return;
    }

    const userId = req.user!.id;
    const existingLikeIndex = postLikes.findIndex((like) => like.post_id === id && like.user_id === userId);

    let liked = false;
    if (existingLikeIndex !== -1) {
      postLikes.splice(existingLikeIndex, 1);
      post.likes_count = Math.max(0, post.likes_count - 1);
    } else {
      postLikes.push({
        id: nextId(postLikes),
        post_id: id,
        user_id: userId,
        created_at: new Date().toISOString()
      });
      post.likes_count += 1;
      liked = true;
    }

    res.json({
      liked,
      likes_count: postLikes.filter((like) => like.post_id === id).length
    });
  });

  api.post("/social/posts/:id/comments", requireAuth, (req: AuthRequest, res) => {
    const { communityPosts, postComments } = getState();
    const id = parseInt(req.params.id, 10);
    const post = communityPosts.find((record) => record.id === id);
    if (!post) {
      res.status(404).json({ detail: "Publicación no encontrada" });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ detail: "El comentario no puede estar vacío" });
      return;
    }
    const cleanContent = String(content).trim().slice(0, 500);

    const newComment: PostComment = {
      id: nextId(postComments),
      post_id: post.id,
      user_id: req.user!.id,
      content: cleanContent,
      created_at: new Date().toISOString()
    };
    postComments.push(newComment);
    post.comments_count += 1;
    res.json({
      ...newComment,
      user: req.user
    });
  });

  api.get("/social/notifications", requireAuth, (req: AuthRequest, res) => {
    const { notifications } = getState();
    const list = notifications
      .filter((notification) => notification.user_id === req.user!.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(list);
  });

  api.post("/social/notifications/mark-read", requireAuth, (req: AuthRequest, res) => {
    const { notifications } = getState();
    for (const notification of notifications) {
      if (notification.user_id === req.user!.id) notification.is_read = true;
    }
    res.json({ message: "Notificaciones marcadas como leídas" });
  });
}
