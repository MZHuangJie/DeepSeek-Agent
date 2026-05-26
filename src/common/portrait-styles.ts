export interface PortraitStyleOption {
  id: string;
  label: string;
  group: string;
  /** 写入英文生图 prompt 的画风描述 */
  promptHint: string;
}

export const PORTRAIT_STYLE_OPTIONS: PortraitStyleOption[] = [
  // 日系动画
  { id: 'anime-2d', group: '日系动画', label: '2D 动漫（通用）', promptHint: '2D anime illustration, cel shading, clean lineart, vibrant colors, character portrait' },
  { id: 'anime-modern', group: '日系动画', label: '现代番剧', promptHint: 'modern anime TV series style, polished digital animation look, soft shading, detailed eyes and hair' },
  { id: 'anime-90s', group: '日系动画', label: '90 年代复古动漫', promptHint: '1990s retro anime style, classic cel animation, nostalgic color palette, hand-drawn aesthetic' },
  { id: 'ghibli', group: '日系动画', label: '吉卜力风', promptHint: 'studio ghibli inspired, soft watercolor backgrounds, warm gentle atmosphere, hand-painted feel' },
  { id: 'shonen', group: '日系动画', label: '少年漫', promptHint: 'shonen manga anime style, dynamic energy, bold outlines, action hero presence' },
  { id: 'shoujo', group: '日系动画', label: '少女漫', promptHint: 'shoujo manga style, delicate features, sparkles, floral motifs, romantic soft lighting' },
  { id: 'galgame', group: '日系动画', label: 'Galgame / 视觉小说', promptHint: 'visual novel character sprite, galgame illustration, clean anime face, game CG quality' },
  { id: 'chibi', group: '日系动画', label: 'Q 版', promptHint: 'chibi style, super deformed, cute proportions, big head small body, kawaii' },

  // 漫画插画
  { id: 'manga-comic', group: '漫画插画', label: '2D 日本漫画', promptHint: 'manga style, comic book inking, dynamic screentone shading, expressive line work' },
  { id: 'webtoon', group: '漫画插画', label: '韩漫 / Webtoon', promptHint: 'korean webtoon manhwa style, soft gradient shading, glossy skin, vertical comic aesthetic' },
  { id: 'american-comic', group: '漫画插画', label: '美漫超级英雄', promptHint: 'american comic book style, bold ink, halftone dots, superhero illustration, dynamic pose' },
  { id: 'semi-realistic', group: '漫画插画', label: '半写实插画', promptHint: 'semi-realistic digital painting, detailed illustration, soft painterly rendering, artstation quality' },
  { id: 'flat-illustration', group: '漫画插画', label: '扁平插画', promptHint: 'flat vector illustration, minimal shading, bold color blocks, modern graphic design style' },
  { id: 'line-art', group: '漫画插画', label: '线稿 / 线描', promptHint: 'clean line art, ink drawing, minimal color, detailed linework, sketchbook quality' },
  { id: 'sketch', group: '漫画插画', label: '铅笔素描', promptHint: 'pencil sketch portrait, graphite drawing, cross hatching, artistic study' },

  // 3D / CG
  { id: '3d-anime', group: '3D / CG', label: '3D 动漫', promptHint: '3D anime render, stylized game character model, soft global illumination, high quality CGI' },
  { id: '3d-pixar', group: '3D / CG', label: '皮克斯 / 3D 卡通', promptHint: 'pixar disney 3D cartoon style, stylized 3D character, subsurface scattering, friendly appeal' },
  { id: '3d-realistic', group: '3D / CG', label: '3D 写实渲染', promptHint: 'hyperrealistic 3D render, octane render, unreal engine quality, detailed PBR materials' },
  { id: '3d-lowpoly', group: '3D / CG', label: '低多边形', promptHint: 'low poly 3D art, geometric facets, stylized minimalist 3D character' },
  { id: '3d-clay', group: '3D / CG', label: '黏土 / 定格动画', promptHint: 'claymation stop motion style, soft clay texture, handmade figurine look' },
  { id: '2-5d', group: '3D / CG', label: '2.5D 立绘', promptHint: '2.5D illustration, anime face with dimensional lighting, live2D inspired depth' },

  // 写实摄影
  { id: 'realistic', group: '写实摄影', label: '真人写实', promptHint: 'photorealistic portrait, live action, realistic skin texture, cinematic lighting, DSLR photo quality' },
  { id: 'cinematic', group: '写实摄影', label: '电影剧照', promptHint: 'cinematic movie still, anamorphic lens, dramatic film lighting, blockbuster production design' },
  { id: 'fashion', group: '写实摄影', label: '时尚大片', promptHint: 'high fashion editorial photography, vogue magazine cover, studio lighting, elegant pose' },
  { id: 'film-noir', group: '写实摄影', label: '黑白胶片', promptHint: 'black and white film noir photography, high contrast, moody shadows, vintage grain' },
  { id: 'polaroid', group: '写实摄影', label: '宝丽来 / 复古照片', promptHint: 'polaroid instant photo aesthetic, vintage color cast, soft focus, nostalgic snapshot' },

  // 传统艺术
  { id: 'oil-painting', group: '传统艺术', label: '古典油画', promptHint: 'classical oil painting portrait, rich brush strokes, museum masterpiece quality, chiaroscuro lighting' },
  { id: 'watercolor', group: '传统艺术', label: '水彩插画', promptHint: 'watercolor illustration, soft edges, paper texture, artistic brush strokes, gentle color bleeding' },
  { id: 'gouache', group: '传统艺术', label: '水粉 / 厚涂', promptHint: 'gouache painting, opaque watercolor, matte texture, illustration book quality' },
  { id: 'impressionist', group: '传统艺术', label: '印象派', promptHint: 'impressionist painting, visible brush strokes, light and color emphasis, plein air atmosphere' },
  { id: 'art-nouveau', group: '传统艺术', label: '新艺术运动', promptHint: 'art nouveau illustration, decorative flowing lines, ornamental floral patterns, alphonse mucha inspired' },
  { id: 'baroque', group: '传统艺术', label: '巴洛克', promptHint: 'baroque portrait painting, dramatic lighting, ornate details, old master style' },
  { id: 'pop-art', group: '传统艺术', label: '波普艺术', promptHint: 'pop art style, bold primary colors, halftone patterns, andy warhol inspired graphic look' },

  // 国风东方
  { id: 'chinese-ink', group: '国风东方', label: '水墨国风', promptHint: 'chinese ink wash painting, shuimo style, flowing brushwork, rice paper texture, elegant hanfu atmosphere' },
  { id: 'chinese-gongbi', group: '国风东方', label: '工笔画', promptHint: 'chinese gongbi fine brush painting, meticulous detail, silk scroll aesthetic, traditional court painting' },
  { id: 'wuxia', group: '国风东方', label: '武侠', promptHint: 'wuxia martial arts illustration, flowing robes, ancient china atmosphere, heroic martial artist' },
  { id: 'xianxia', group: '国风东方', label: '仙侠', promptHint: 'xianxia fantasy cultivation style, ethereal immortal aura, flowing sleeves, mystical eastern fantasy' },
  { id: 'ukiyo-e', group: '国风东方', label: '浮世绘', promptHint: 'ukiyo-e woodblock print style, flat color areas, bold outlines, japanese edo period aesthetic' },

  // 欧美风格
  { id: 'western-fantasy', group: '欧美风格', label: '欧美奇幻', promptHint: 'western high fantasy illustration, dungeons and dragons character art, detailed armor and costume' },
  { id: 'dark-fantasy', group: '欧美风格', label: '暗黑奇幻', promptHint: 'dark fantasy art, gothic atmosphere, moody shadows, sinister elegant design' },
  { id: 'gothic', group: '欧美风格', label: '哥特', promptHint: 'gothic portrait, victorian gothic fashion, ornate dark elegance, cathedral mood' },
  { id: 'victorian', group: '欧美风格', label: '维多利亚', promptHint: 'victorian era portrait, 19th century fashion, classical composition, antique photograph feel' },
  { id: 'steampunk', group: '欧美风格', label: '蒸汽朋克', promptHint: 'steampunk character design, brass gears, Victorian industrial, retro-futuristic accessories' },

  // 科幻奇幻
  { id: 'cyberpunk', group: '科幻奇幻', label: '赛博朋克', promptHint: 'cyberpunk character, neon lights, futuristic techwear, rain-soaked city glow, blade runner atmosphere' },
  { id: 'sci-fi', group: '科幻奇幻', label: '科幻未来', promptHint: 'science fiction character design, futuristic suit, sleek technology, space opera aesthetic' },
  { id: 'mecha', group: '科幻奇幻', label: '机甲', promptHint: 'mecha anime style, pilot suit, mechanical details, giant robot sci-fi aesthetic' },
  { id: 'post-apocalyptic', group: '科幻奇幻', label: '废土末世', promptHint: 'post-apocalyptic survivor portrait, worn gear, dusty atmosphere, mad max inspired grit' },
  { id: 'space-opera', group: '科幻奇幻', label: '太空歌剧', promptHint: 'space opera sci-fi illustration, starship crew uniform, cosmic background, epic scale' },

  // 特殊风格
  { id: 'horror', group: '特殊风格', label: '恐怖悬疑', promptHint: 'horror thriller portrait, unsettling mood, dramatic shadows, psychological tension' },
  { id: 'vaporwave', group: '特殊风格', label: '蒸汽波', promptHint: 'vaporwave aesthetic, retro 80s 90s, pink and cyan gradient, glitch art nostalgia' },
  { id: 'synthwave', group: '特殊风格', label: '合成波 / 霓虹 retro', promptHint: 'synthwave retrowave, neon grid sunset, chrome reflections, 1980s futuristic nostalgia' },
  { id: 'pixel', group: '特殊风格', label: '像素风', promptHint: 'pixel art, retro game sprite style, limited color palette, crisp pixels' },
  { id: 'pixel-modern', group: '特殊风格', label: '现代像素 HD', promptHint: 'modern HD pixel art, detailed pixel illustration, indie game character portrait' },
  { id: 'stained-glass', group: '特殊风格', label: '彩色玻璃', promptHint: 'stained glass window art, bold black outlines, luminous colored glass segments' },
  { id: 'paper-cut', group: '特殊风格', label: '剪纸', promptHint: 'chinese paper cutting art, layered silhouette, intricate cutout patterns, folk craft aesthetic' },
  { id: 'graffiti', group: '特殊风格', label: '街头涂鸦', promptHint: 'street graffiti art portrait, spray paint texture, urban wall mural, bold hip hop aesthetic' },
  { id: 'tarot', group: '特殊风格', label: '塔罗牌', promptHint: 'tarot card illustration, ornate border, symbolic mystical portrait, esoteric art nouveau details' },
  { id: 'y2k', group: '特殊风格', label: 'Y2K 千禧风', promptHint: 'Y2K aesthetic, glossy chrome, butterfly clips era, early 2000s digital nostalgia, iridescent colors' },
];

export type PortraitStyleId = (typeof PORTRAIT_STYLE_OPTIONS)[number]['id'];

export const DEFAULT_PORTRAIT_STYLE: PortraitStyleId = 'anime-2d';

/** 按分组顺序排列，供 UI optgroup 使用 */
export const PORTRAIT_STYLE_GROUPS: string[] = [
  '日系动画',
  '漫画插画',
  '3D / CG',
  '写实摄影',
  '传统艺术',
  '国风东方',
  '欧美风格',
  '科幻奇幻',
  '特殊风格',
];

export function resolvePortraitStyle(id?: string): PortraitStyleOption {
  return PORTRAIT_STYLE_OPTIONS.find(s => s.id === id) ?? PORTRAIT_STYLE_OPTIONS[0];
}

export function getPortraitStylesByGroup(group: string): PortraitStyleOption[] {
  return PORTRAIT_STYLE_OPTIONS.filter(s => s.group === group);
}
