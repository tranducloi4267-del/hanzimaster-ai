export interface ConfusableGroup {
  id: string;
  title: string;
  type: 'visual' | 'homophone' | 'grammar';
  items: Array<{
    hanzi: string;
    pinyin: string;
    meaningVi: string;
    tipVi: string;
    exampleSentence: string;
    examplePinyin: string;
    exampleVi: string;
  }>;
}

/**
 * Bộ cặp chữ hình cận tự (形近字) & đồng âm dễ nhầm chuẩn HSK 1–6.
 * Dùng cho cả Tab 2 Chi tiết từ vựng và Game 5 (Truy tìm Giả mạo — Confusable Hunter).
 */
export const CONFUSABLE_GROUPS: ConfusableGroup[] = [
  {
    id: 'cfg_mai',
    title: '买 (mua) vs 卖 (bán)',
    type: 'visual',
    items: [
      {
        hanzi: '买',
        pinyin: 'mǎi',
        meaningVi: 'mua',
        tipVi: 'Không có chữ 十 ở trên — đi mua đồ là tay không đi vào.',
        exampleSentence: '我想买一杯咖啡。',
        examplePinyin: 'Wǒ xiǎng mǎi yī bēi kāfēi.',
        exampleVi: 'Tôi muốn mua một cốc cà phê.'
      },
      {
        hanzi: '卖',
        pinyin: 'mài',
        meaningVi: 'bán',
        tipVi: 'Có chữ 十 (thập/nhiều) đội trên đầu — phải có nhiều hàng mới bán được.',
        exampleSentence: '这家商店卖水果。',
        examplePinyin: 'Zhè jiā shāngdiàn mài shuǐguǒ.',
        exampleVi: 'Cửa hàng này bán trái cây.'
      }
    ]
  },
  {
    id: 'cfg_ji_yi',
    title: '己 (bản thân) vs 已 (đã) vs 巳 (Tỵ)',
    type: 'visual',
    items: [
      {
        hanzi: '己',
        pinyin: 'jǐ',
        meaningVi: 'bản thân, tự mình',
        tipVi: 'Hở hoàn toàn bên trái — tự mở lòng với chính mình (自己).',
        exampleSentence: '我自己做饭。',
        examplePinyin: 'Wǒ zìjǐ zuòfàn.',
        exampleVi: 'Tôi tự mình nấu cơm.'
      },
      {
        hanzi: '已',
        pinyin: 'yǐ',
        meaningVi: 'đã, rồi',
        tipVi: 'Đóng một nửa — việc đã qua một nửa rồi (已经).',
        exampleSentence: '他已经回家了。',
        examplePinyin: 'Tā yǐjīng huíjiā le.',
        exampleVi: 'Anh ấy đã về nhà rồi.'
      }
    ]
  },
  {
    id: 'cfg_da_tai',
    title: '大 (to) vs 太 (quá) vs 犬 (chó) vs 天 (trời)',
    type: 'visual',
    items: [
      {
        hanzi: '大',
        pinyin: 'dà',
        meaningVi: 'to, lớn',
        tipVi: 'Hình người dang rộng hai tay hai chân.',
        exampleSentence: '这个苹果很大。',
        examplePinyin: 'Zhège píngguǒ hěn dà.',
        exampleVi: 'Quả táo này rất to.'
      },
      {
        hanzi: '太',
        pinyin: 'tài',
        meaningVi: 'quá, lắm',
        tipVi: 'Chữ 大 thêm 1 chấm bên dưới — quá mức lớn rồi.',
        exampleSentence: '今天太热了！',
        examplePinyin: 'Jīntiān tài rè le!',
        exampleVi: 'Hôm nay nóng quá đi!'
      },
      {
        hanzi: '天',
        pinyin: 'tiān',
        meaningVi: 'trời, ngày',
        tipVi: 'Nét ngang trên đầu chữ 大 — bầu trời cao hơn đầu người.',
        exampleSentence: '今天天气很好。',
        examplePinyin: 'Jīntiān tiānqì hěn hǎo.',
        exampleVi: 'Thời tiết hôm nay rất đẹp.'
      }
    ]
  },
  {
    id: 'cfg_ren_ru_ba',
    title: '人 (người) vs 入 (vào) vs 八 (tám)',
    type: 'visual',
    items: [
      {
        hanzi: '人',
        pinyin: 'rén',
        meaningVi: 'con người',
        tipVi: 'Nét phẩy cao hơn, nét mác tựa vào giữa nét phẩy.',
        exampleSentence: '这里人很多。',
        examplePinyin: 'Zhèlǐ rén hěn duō.',
        exampleVi: 'Ở đây có rất nhiều người.'
      },
      {
        hanzi: '入',
        pinyin: 'rù',
        meaningVi: 'vào, lối vào',
        tipVi: 'Ngược với 人: nét mác cao hơn đè lên đỉnh nét phẩy (入口 lối vào).',
        exampleSentence: '请从入口进去。',
        examplePinyin: 'Qǐng cóng rùkǒu jìnqù.',
        exampleVi: 'Xin vui lòng đi vào từ lối vào.'
      },
      {
        hanzi: '八',
        pinyin: 'bā',
        meaningVi: 'số tám',
        tipVi: 'Hai nét tách rời nhau ở trên đầu.',
        exampleSentence: '现在八点了。',
        examplePinyin: 'Xiànzài bā diǎn le.',
        exampleVi: 'Bây giờ là tám giờ rồi.'
      }
    ]
  },
  {
    id: 'cfg_ri_mu_bai',
    title: '日 (ngày/mặt trời) vs 目 (mắt) vs 白 (trắng)',
    type: 'visual',
    items: [
      {
        hanzi: '日',
        pinyin: 'rì',
        meaningVi: 'ngày, mặt trời',
        tipVi: 'Chỉ có 1 nét ngang ở giữa.',
        exampleSentence: '今天是我的生日。',
        examplePinyin: 'Jīntiān shì wǒ de shēngrì.',
        exampleVi: 'Hôm nay là sinh nhật của tôi.'
      },
      {
        hanzi: '目',
        pinyin: 'mù',
        meaningVi: 'mắt, mục lục',
        tipVi: 'Có 2 nét ngang bên trong như hai mí mắt (目前, 节目).',
        exampleSentence: '这个电视节目很有意思。',
        examplePinyin: 'Zhège diànshì jiémù hěn yǒu yìsi.',
        exampleVi: 'Chương trình truyền hình này rất thú vị.'
      },
      {
        hanzi: '白',
        pinyin: 'bái',
        meaningVi: 'màu trắng',
        tipVi: 'Chữ 日 thêm nét phẩy nhỏ trên đỉnh đầu.',
        exampleSentence: '她穿着一件白衣服。',
        examplePinyin: 'Tā chuānzhe yī jiàn bái yīfu.',
        exampleVi: 'Cô ấy mặc một chiếc áo màu trắng.'
      }
    ]
  },
  {
    id: 'cfg_qing_family',
    title: '请 (mời) vs 晴 (nắng) vs 清 (trong) vs 情 (tình)',
    type: 'visual',
    items: [
      {
        hanzi: '请',
        pinyin: 'qǐng',
        meaningVi: 'xin mời, nhờ',
        tipVi: 'Bộ 讠 (ngôn - lời nói): nói lời mời lịch sự.',
        exampleSentence: '请坐，喝茶吧。',
        examplePinyin: 'Qǐng zuò, hē chá ba.',
        exampleVi: 'Mời ngồi, uống trà đi.'
      },
      {
        hanzi: '晴',
        pinyin: 'qíng',
        meaningVi: 'trời nắng, quang đãng',
        tipVi: 'Bộ 日 (mặt trời): có mặt trời là trời nắng.',
        exampleSentence: '明天是晴天。',
        examplePinyin: 'Míngtiān shì qíngtiān.',
        exampleVi: 'Ngày mai là ngày nắng.'
      },
      {
        hanzi: '清',
        pinyin: 'qīng',
        meaningVi: 'trong sạch, rõ ràng',
        tipVi: 'Bộ 氵 (nước): nước trong vắt (清楚 rõ ràng).',
        exampleSentence: '我听得很清楚。',
        examplePinyin: 'Wǒ tīng de hěn qīngchu.',
        exampleVi: 'Tôi nghe rất rõ ràng.'
      },
      {
        hanzi: '情',
        pinyin: 'qíng',
        meaningVi: 'tình cảm, sự việc',
        tipVi: 'Bộ 忄 (tâm - trái tim): cảm xúc trong lòng (事情, 心情).',
        exampleSentence: '我今天心情很好。',
        examplePinyin: 'Wǒ jīntiān xīnqíng hěn hǎo.',
        exampleVi: 'Tâm trạng hôm nay của tôi rất tốt.'
      }
    ]
  },
  {
    id: 'cfg_he_ke',
    title: '喝 (uống) vs 渴 (khát)',
    type: 'visual',
    items: [
      {
        hanzi: '喝',
        pinyin: 'hē',
        meaningVi: 'uống',
        tipVi: 'Bộ 口 (miệng): dùng miệng để uống.',
        exampleSentence: '我想喝水。',
        examplePinyin: 'Wǒ xiǎng hē shuǐ.',
        exampleVi: 'Tôi muốn uống nước.'
      },
      {
        hanzi: '渴',
        pinyin: 'kě',
        meaningVi: 'khát nước',
        tipVi: 'Bộ 氵 (nước): thiếu nước nên thấy khát.',
        exampleSentence: '我跑完步很渴。',
        examplePinyin: 'Wǒ pǎowán bù hěn kě.',
        exampleVi: 'Tôi chạy bộ xong rất khát.'
      }
    ]
  },
  {
    id: 'cfg_zai',
    title: '在 (đang/ở) vs 再 (lại/nữa)',
    type: 'homophone',
    items: [
      {
        hanzi: '在',
        pinyin: 'zài',
        meaningVi: 'ở tại, đang làm gì',
        tipVi: 'Có bộ 土 (đất): chỉ vị trí ở đâu hoặc hành động đang diễn ra.',
        exampleSentence: '我在图书馆看书。',
        examplePinyin: 'Wǒ zài túshūguǎn kànshū.',
        exampleVi: 'Tôi đang đọc sách ở thư viện.'
      },
      {
        hanzi: '再',
        pinyin: 'zài',
        meaningVi: 'lại, lần nữa (tương lai)',
        tipVi: 'Dùng cho hành động lặp lại trong tương lai (再见, 再说一遍).',
        exampleSentence: '请再说一遍。',
        examplePinyin: 'Qǐng zài shuō yī biàn.',
        exampleVi: 'Xin hãy nói lại một lần nữa.'
      }
    ]
  },
  {
    id: 'cfg_zuo',
    title: '做 (làm) vs 坐 (ngồi) vs 作 (tác phẩm/công việc)',
    type: 'homophone',
    items: [
      {
        hanzi: '做',
        pinyin: 'zuò',
        meaningVi: 'làm (cụ thể: nấu ăn, làm bài)',
        tipVi: 'Bộ 亻 (người) + 故: làm công việc cụ thể (做饭, 做作业).',
        exampleSentence: '妈妈正在做晚饭。',
        examplePinyin: 'Māma zhèngzài zuò wǎnfàn.',
        exampleVi: 'Mẹ đang nấu bữa tối.'
      },
      {
        hanzi: '坐',
        pinyin: 'zuò',
        meaningVi: 'ngồi, đi bằng phương tiện',
        tipVi: 'Hai người (人人) ngồi trên mặt đất (土).',
        exampleSentence: '我每天坐地铁上班。',
        examplePinyin: 'Wǒ měitiān zuò dìtiě shàngbān.',
        exampleVi: 'Tôi đi làm bằng tàu điện ngầm mỗi ngày.'
      },
      {
        hanzi: '作',
        pinyin: 'zuò',
        meaningVi: 'làm việc, sáng tác (trừu tượng)',
        tipVi: 'Thường đi trong từ ghép (工作 công việc, 作业 bài tập).',
        exampleSentence: '你的工作忙吗？',
        examplePinyin: 'Nǐ de gōngzuò máng ma?',
        exampleVi: 'Công việc của bạn có bận không?'
      }
    ]
  },
  {
    id: 'cfg_kuai',
    title: '快 (nhanh) vs 块 (tệ/miếng)',
    type: 'visual',
    items: [
      {
        hanzi: '快',
        pinyin: 'kuài',
        meaningVi: 'nhanh, sắp, vui vẻ',
        tipVi: 'Bộ 忄 (tâm): lòng vui vẻ/gấp gáp nhanh lên (快乐, 快一点).',
        exampleSentence: '时间过得真快！',
        examplePinyin: 'Shíjiān guò de zhēn kuài!',
        exampleVi: 'Thời gian trôi thật nhanh!'
      },
      {
        hanzi: '块',
        pinyin: 'kuài',
        meaningVi: 'đồng (tiền), miếng, cục',
        tipVi: 'Bộ 土 (đất): một cục đất / miếng bánh / đồng tiền.',
        exampleSentence: '这本书三十块钱。',
        examplePinyin: 'Zhè běn shū sānshí kuài qián.',
        exampleVi: 'Cuốn sách này giá 30 tệ.'
      }
    ]
  },
  {
    id: 'cfg_jin',
    title: '进 (vào) vs 近 (gần)',
    type: 'visual',
    items: [
      {
        hanzi: '进',
        pinyin: 'jìn',
        meaningVi: 'đi vào, tiến bộ',
        tipVi: 'Bên trong là chữ 井 (giếng) — bước vào trong.',
        exampleSentence: '请进，不要客气。',
        examplePinyin: 'Qǐng jìn, bùyào kèqi.',
        exampleVi: 'Mời vào, đừng khách sáo.'
      },
      {
        hanzi: '近',
        pinyin: 'jìn',
        meaningVi: 'gần (khoảng cách/thời gian)',
        tipVi: 'Bên trong là chữ 斤 (cân/rìu) — 最近 (gần đây), 附近 (lân cận).',
        exampleSentence: '我家离学校很近。',
        examplePinyin: 'Wǒ jiā lí xuéxiào hěn jìn.',
        exampleVi: 'Nhà tôi rất gần trường học.'
      }
    ]
  },
  {
    id: 'cfg_de',
    title: '的 (định ngữ) vs 地 (trạng ngữ) vs 得 (bổ ngữ)',
    type: 'grammar',
    items: [
      {
        hanzi: '的',
        pinyin: 'de',
        meaningVi: 'của (đứng trước Danh từ)',
        tipVi: 'Công thức: Định ngữ + 的 + Danh từ (我的书, 漂亮的花).',
        exampleSentence: '这是我的汉语老师。',
        examplePinyin: 'Zhè shì wǒ de Hànyǔ lǎoshī.',
        exampleVi: 'Đây là giáo viên tiếng Trung của tôi.'
      },
      {
        hanzi: '地',
        pinyin: 'de',
        meaningVi: 'một cách... (đứng trước Động từ)',
        tipVi: 'Công thức: Tính từ/Trạng ngữ + 地 + Động từ (高兴地说).',
        exampleSentence: '他认真地学习中文。',
        examplePinyin: 'Tā rènzhēn de xuéxí Zhōngwén.',
        exampleVi: 'Anh ấy học tiếng Trung một cách chăm chỉ.'
      },
      {
        hanzi: '得',
        pinyin: 'de',
        meaningVi: 'đến mức... (đứng sau Động từ)',
        tipVi: 'Công thức: Động từ + 得 + Bổ ngữ đánh giá (说得很好).',
        exampleSentence: '她说汉语说得很流利。',
        examplePinyin: 'Tā shuō Hànyǔ shuō de hěn liúlì.',
        exampleVi: 'Cô ấy nói tiếng Trung rất lưu loát.'
      }
    ]
  },
  {
    id: 'cfg_ta',
    title: '他 (anh ấy) vs 她 (cô ấy) vs 它 (nó)',
    type: 'homophone',
    items: [
      {
        hanzi: '他',
        pinyin: 'tā',
        meaningVi: 'anh ấy, ông ấy (nam / chung)',
        tipVi: 'Bộ 亻 (nhân - người).',
        exampleSentence: '他是我的同学。',
        examplePinyin: 'Tā shì wǒ de tóngxué.',
        exampleVi: 'Anh ấy là bạn học của tôi.'
      },
      {
        hanzi: '她',
        pinyin: 'tā',
        meaningVi: 'cô ấy, chị ấy, bà ấy (nữ)',
        tipVi: 'Bộ 女 (nữ - phụ nữ).',
        exampleSentence: '她是我姐姐。',
        examplePinyin: 'Tā shì wǒ jiějie.',
        exampleVi: 'Cô ấy là chị gái tôi.'
      },
      {
        hanzi: '它',
        pinyin: 'tā',
        meaningVi: 'nó (con vật, đồ vật)',
        tipVi: 'Bộ 宀 (mái nhà): dùng cho vật và động vật.',
        exampleSentence: '这只小猫很可爱，我很喜欢它。',
        examplePinyin: 'Zhè zhī xiǎomāo hěn kěài, wǒ hěn xǐhuan tā.',
        exampleVi: 'Chú mèo nhỏ này rất đáng yêu, tôi rất thích nó.'
      }
    ]
  },
  {
    id: 'cfg_wen_jian',
    title: '问 (hỏi) vs 间 (gian/khoảng)',
    type: 'visual',
    items: [
      {
        hanzi: '问',
        pinyin: 'wèn',
        meaningVi: 'hỏi, câu hỏi',
        tipVi: 'Cái miệng (口) thò qua cửa (门) để hỏi đường (问题).',
        exampleSentence: '请问，洗手间在哪儿？',
        examplePinyin: 'Qǐngwèn, xǐshǒujiān zài nǎr?',
        exampleVi: 'Xin hỏi, nhà vệ sinh ở đâu ạ?'
      },
      {
        hanzi: '间',
        pinyin: 'jiān',
        meaningVi: 'gian phòng, khoảng thời gian',
        tipVi: 'Ánh nắng mặt trời (日) lọt qua khe cửa (门) (时间, 房间).',
        exampleSentence: '你明天有时间吗？',
        examplePinyin: 'Nǐ míngtiān yǒu shíjiān ma?',
        exampleVi: 'Ngày mai bạn có thời gian không?'
      }
    ]
  },
  {
    id: 'cfg_mu_ben',
    title: '木 (gỗ) vs 本 (gốc/quyển) vs 休 (nghỉ) vs 体 (cơ thể)',
    type: 'visual',
    items: [
      {
        hanzi: '本',
        pinyin: 'běn',
        meaningVi: 'gốc rễ, quyển (lượng từ sách)',
        tipVi: 'Gạch 1 nét dưới rễ cây 木 → gốc rễ, bản gốc.',
        exampleSentence: '我买了两本中文书。',
        examplePinyin: 'Wǒ mǎile liǎng běn Zhōngwén shū.',
        exampleVi: 'Tôi đã mua hai quyển sách tiếng Trung.'
      },
      {
        hanzi: '休',
        pinyin: 'xiū',
        meaningVi: 'nghỉ ngơi',
        tipVi: 'Người (亻) tựa vào gốc cây (木) để nghỉ ngơi (休息).',
        exampleSentence: '累了就休息一下吧。',
        examplePinyin: 'Lèi le jiù xiūxi yīxià ba.',
        exampleVi: 'Mệt rồi thì nghỉ ngơi một lát đi.'
      },
      {
        hanzi: '体',
        pinyin: 'tǐ',
        meaningVi: 'cơ thể, thể thao',
        tipVi: 'Người (亻) + 本 (gốc): cơ thể là gốc của con người (身体, 体育).',
        exampleSentence: '祝你身体健康！',
        examplePinyin: 'Zhù nǐ shēntǐ jiànkāng!',
        exampleVi: 'Chúc bạn sức khỏe dồi dào!'
      }
    ]
  },
  {
    id: 'cfg_ma',
    title: '妈 (mẹ) vs 吗 (không?) vs 马 (ngựa)',
    type: 'visual',
    items: [
      {
        hanzi: '妈',
        pinyin: 'mā',
        meaningVi: 'mẹ, má',
        tipVi: 'Bộ 女 (nữ) + 马 (chỉ âm mã): người phụ nữ là mẹ.',
        exampleSentence: '妈妈做的菜最好吃。',
        examplePinyin: 'Māma zuò de cài zuì hǎochī.',
        exampleVi: 'Món ăn mẹ nấu là ngon nhất.'
      },
      {
        hanzi: '吗',
        pinyin: 'ma',
        meaningVi: 'không? (trợ từ nghi vấn)',
        tipVi: 'Bộ 口 (miệng) đặt cuối câu để hỏi.',
        exampleSentence: '你喝咖啡吗？',
        examplePinyin: 'Nǐ hē kāfēi ma?',
        exampleVi: 'Bạn có uống cà phê không?'
      },
      {
        hanzi: '马',
        pinyin: 'mǎ',
        meaningVi: 'con ngựa, ngay lập tức (马上)',
        tipVi: 'Tượng hình con ngựa đang phi nước đại.',
        exampleSentence: '我马上就到！',
        examplePinyin: 'Wǒ mǎshàng jiù dào!',
        exampleVi: 'Tôi đến ngay lập tức đây!'
      }
    ]
  },
  {
    id: 'cfg_wan',
    title: '玩 (chơi) vs 完 (xong)',
    type: 'homophone',
    items: [
      {
        hanzi: '玩',
        pinyin: 'wán',
        meaningVi: 'chơi, vui chơi',
        tipVi: 'Bộ 王 (ngọc): xưa cầm ngọc thưởng ngoạn, chơi đùa.',
        exampleSentence: '周末我们去公园玩吧。',
        examplePinyin: 'Zhōumò wǒmen qù gōngyuán wán ba.',
        exampleVi: 'Cuối tuần chúng ta đi công viên chơi đi.'
      },
      {
        hanzi: '完',
        pinyin: 'wán',
        meaningVi: 'xong, hoàn thành',
        tipVi: 'Bộ 宀 (mái nhà): xây xong mái nhà là hoàn thành (完成, 看完).',
        exampleSentence: '我已经做完作业了。',
        examplePinyin: 'Wǒ yǐjīng zuòwán zuòyè le.',
        exampleVi: 'Tôi đã làm xong bài tập rồi.'
      }
    ]
  },
  {
    id: 'cfg_hua_huo',
    title: '话 (lời nói) vs 活 (sống/hoạt động)',
    type: 'visual',
    items: [
      {
        hanzi: '话',
        pinyin: 'huà',
        meaningVi: 'lời nói, câu chuyện, điện thoại',
        tipVi: 'Bộ 讠 (ngôn) + 舌 (lưỡi): lời nói từ lưỡi (说话, 电话).',
        exampleSentence: '我想给你打电话。',
        examplePinyin: 'Wǒ xiǎng gěi nǐ dǎ diànhuà.',
        exampleVi: 'Tôi muốn gọi điện cho bạn.'
      },
      {
        hanzi: '活',
        pinyin: 'huó',
        meaningVi: 'sống, sinh hoạt, linh hoạt',
        tipVi: 'Bộ 氵 (nước) + 舌 (lưỡi): có nước mới sống được (生活, 活动).',
        exampleSentence: '你的生活很丰富。',
        examplePinyin: 'Nǐ de shēnghuó hěn fēngfù.',
        exampleVi: 'Cuộc sống của bạn rất phong phú.'
      }
    ]
  },
  {
    id: 'cfg_xiang',
    title: '想 (nghĩ/nhớ/muốn) vs 像 (giống như)',
    type: 'visual',
    items: [
      {
        hanzi: '想',
        pinyin: 'xiǎng',
        meaningVi: 'muốn, suy nghĩ, nhớ nhung',
        tipVi: 'Dưới có bộ 心 (tâm): nghĩ và nhớ trong lòng.',
        exampleSentence: '我很想我的家人。',
        examplePinyin: 'Wǒ hěn xiǎng wǒ de jiārén.',
        exampleVi: 'Tôi rất nhớ gia đình mình.'
      },
      {
        hanzi: '像',
        pinyin: 'xiàng',
        meaningVi: 'giống như, hình tượng',
        tipVi: 'Bộ 亻 (người) + 象 (voi): trông giống như (好像).',
        exampleSentence: '她长得很像她妈妈。',
        examplePinyin: 'Tā zhǎng de hěn xiàng tā māma.',
        exampleVi: 'Cô ấy trông rất giống mẹ mình.'
      }
    ]
  },
  {
    id: 'cfg_zhao_wo',
    title: '找 (tìm) vs 我 (tôi)',
    type: 'visual',
    items: [
      {
        hanzi: '找',
        pinyin: 'zhǎo',
        meaningVi: 'tìm kiếm, trả tiền thừa',
        tipVi: 'Bên trái là bộ 扌 (tay) — dùng tay tìm đồ.',
        exampleSentence: '我在找我的手机。',
        examplePinyin: 'Wǒ zài zhǎo wǒ de shǒujī.',
        exampleVi: 'Tôi đang tìm điện thoại của mình.'
      },
      {
        hanzi: '我',
        pinyin: 'wǒ',
        meaningVi: 'tôi, ta',
        tipVi: 'Bên trái có thêm nét phẩy trên đầu (手 + 戈).',
        exampleSentence: '我是越南人。',
        examplePinyin: 'Wǒ shì Yuènán rén.',
        exampleVi: 'Tôi là người Việt Nam.'
      }
    ]
  }
];

export const CONFUSABLE_MAP = new Map<string, string[]>();
for (const g of CONFUSABLE_GROUPS) {
  const allChars = g.items.map((i) => i.hanzi);
  for (const item of g.items) {
    CONFUSABLE_MAP.set(
      item.hanzi,
      allChars.filter((c) => c !== item.hanzi)
    );
  }
}
