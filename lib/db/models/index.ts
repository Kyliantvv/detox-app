import { Block } from "./block";
import { CloseFriend } from "./close-friend";
import { Comment } from "./comment";
import { Conversation } from "./conversation";
import { Draw } from "./draw";
import { Follow } from "./follow";
import { Like } from "./like";
import { Message } from "./message";
import { Order } from "./order";
import { PointEvent } from "./point-event";
import { Post } from "./post";
import { ProfileView } from "./profile-view";
import { Repost } from "./repost";
import { Save } from "./save";
import { ShopItem } from "./shop-item";
import { SkillPurchase } from "./skill-purchase";
import { Story } from "./story";
import { User } from "./user";

// Liste explicite : les index ne dépendent pas de l'ordre des imports.
export const ALL_MODELS = [
  Block, CloseFriend, Comment, Conversation, Draw, Follow, Like, Message, Order,
  PointEvent, Post, ProfileView, Repost, Save, ShopItem, SkillPurchase, Story, User,
];
