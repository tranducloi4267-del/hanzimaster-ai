import type { LessonContent } from '@/types';

export type LessonTopicCategory =
  | 'Giao tiếp'
  | 'Ăn uống'
  | 'Mua sắm'
  | 'Du lịch & Giao thông'
  | 'Học tập & Công việc'
  | 'Sức khỏe & Đời sống';

export interface CuratedLesson {
  id: string;
  level: number; // HSK 1..6
  category: LessonTopicCategory;
  title: string;
  targetWords: string[];
  content: LessonContent;
}

export const LESSON_TOPIC_CATEGORIES: LessonTopicCategory[] = [
  'Giao tiếp',
  'Ăn uống',
  'Mua sắm',
  'Du lịch & Giao thông',
  'Học tập & Công việc',
  'Sức khỏe & Đời sống'
];

/**
 * Kho 30 bài khóa dựng sẵn phân cấp đầy đủ HSK 1 → HSK 6 & 6 chủ đề thiết thực
 * giúp người học chọn ngay lúc mở app và học mượt 100% offline.
 */
export const CURATED_LESSONS: CuratedLesson[] = [
  // ==================== HSK 1 (5 bài) ====================
  {
    id: 'curated_hsk1_greet',
    level: 1,
    category: 'Giao tiếp',
    title: '初次见面 (Lần đầu gặp mặt & làm quen)',
    targetWords: ['你好', '叫', '名字', '认识', '高兴', '中国', '朋友'],
    content: {
      topic: 'Giao tiếp',
      summaryVi: 'Hội thoại giới thiệu tên, quốc tịch và chào hỏi thân thiện lần đầu gặp gỡ.',
      lines: [
        { speaker: '小兰', hanzi: '你好！请问你叫什么名字？', pinyin: 'Nǐ hǎo! Qǐngwèn nǐ jiào shénme míngzi?', translationVi: 'Xin chào! Xin hỏi bạn tên là gì?' },
        { speaker: '小明', hanzi: '你好！我叫小明，我是越南人。你呢？', pinyin: 'Nǐ hǎo! Wǒ jiào Xiǎomíng, wǒ shì Yuènánrén. Nǐ ne?', translationVi: 'Chào bạn! Mình tên là Tiểu Minh, mình là người Việt Nam. Còn bạn?' },
        { speaker: '小兰', hanzi: '我叫小兰，我是中国人。很高兴认识你！', pinyin: 'Wǒ jiào Xiǎolán, wǒ shì Zhōngguórén. Hěn gāoxìng rènshi nǐ!', translationVi: 'Mình tên là Tiểu Lan, mình là người Trung Quốc. Rất vui được quen bạn!' },
        { speaker: '小明', hanzi: '我也很高兴认识你。我们可以做好朋友吗？', pinyin: 'Wǒ yě hěn gāoxìng rènshi nǐ. Wǒmen kěyǐ zuò hǎo péngyou ma?', translationVi: 'Mình cũng rất vui được quen bạn. Chúng ta có thể làm bạn tốt không?' },
        { speaker: '小兰', hanzi: '当然可以！以后我们一起学习汉语吧。', pinyin: 'Dāngrán kěyǐ! Yǐhòu wǒmen yīqǐ xuéxí Hànyǔ ba.', translationVi: 'Đương nhiên được rồi! Sau này chúng ta cùng nhau học tiếng Trung nhé.' }
      ],
      grammarPoints: [
        { pattern: '叫 + 名字 (Tên là...)', explanationVi: 'Dùng động từ 叫 (jiào) để giới thiệu tên bản thân hoặc hỏi tên người khác.', exampleHanzi: '我叫小明。', examplePinyin: 'Wǒ jiào Xiǎomíng.', exampleVi: 'Tôi tên là Tiểu Minh.' },
        { pattern: '很高兴认识你', explanationVi: 'Mẫu câu lịch sự tiêu chuẩn khi mới làm quen; 很 đóng vai trò đệm tự nhiên trước tính từ.', exampleHanzi: '很高兴认识你！', examplePinyin: 'Hěn gāoxìng rènshi nǐ!', exampleVi: 'Rất vui được làm quen với bạn!' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '小明是哪国人？', questionPinyin: 'Xiǎomíng shì nǎ guó rén?', questionVi: 'Tiểu Minh là người nước nào?', sampleAnswerHanzi: '小明是越南人。', sampleAnswerPinyin: 'Xiǎomíng shì Yuènánrén.', sampleAnswerVi: 'Tiểu Minh là người Việt Nam.' },
        { id: 'q2', questionHanzi: '小兰和小明以后打算一起做什么？', questionPinyin: 'Xiǎolán hé Xiǎomíng yǐhòu dǎsuàn yīqǐ zuò shénme?', questionVi: 'Tiểu Lan và Tiểu Minh dự định sau này cùng làm gì?', sampleAnswerHanzi: '他们打算一起学习汉语。', sampleAnswerPinyin: 'Tāmen dǎsuàn yīqǐ xuéxí Hànyǔ.', sampleAnswerVi: 'Họ dự định cùng nhau học tiếng Trung.' }
      ]
    }
  },
  {
    id: 'curated_hsk1_food',
    level: 1,
    category: 'Ăn uống',
    title: '点茶和吃饭 (Gọi trà và dùng bữa)',
    targetWords: ['想', '吃', '喝', '茶', '米饭', '菜', '好吃'],
    content: {
      topic: 'Ăn uống',
      summaryVi: 'Học cách gọi đồ uống, món ăn cơ bản và khen món ăn ngon ở quán ăn Trung Quốc.',
      lines: [
        { speaker: '服务员', hanzi: '你好！请问你想喝点儿什么？', pinyin: 'Nǐ hǎo! Qǐngwèn nǐ xiǎng hē diǎnr shénme?', translationVi: 'Xin chào! Xin hỏi bạn muốn uống chút gì?' },
        { speaker: '大卫', hanzi: '我想喝一杯热茶，谢谢。', pinyin: 'Wǒ xiǎng hē yī bēi rè chá, xièxie.', translationVi: 'Tôi muốn uống một cốc trà nóng, cảm ơn.' },
        { speaker: '服务员', hanzi: '好的。请问你要吃米饭还是面条？', pinyin: 'Hǎo de. Qǐngwèn nǐ yào chī mǐfàn háishi miàntiáo?', translationVi: 'Vâng ạ. Xin hỏi bạn muốn ăn cơm hay mì?' },
        { speaker: '大卫', hanzi: '我要一碗米饭和一个中国菜。', pinyin: 'Wǒ yào yī wǎn mǐfàn hé yī gè Zhōngguó cài.', translationVi: 'Tôi lấy một bát cơm và một món ăn Trung Quốc.' },
        { speaker: '大卫', hanzi: '这个菜很好吃，茶也很好喝！', pinyin: 'Zhège cài hěn hǎochī, chá yě hěn hǎohē!', translationVi: 'Món này rất ngon, trà cũng rất thơm ngon!' }
      ],
      grammarPoints: [
        { pattern: '想 + Động từ (Muốn làm gì)', explanationVi: 'Biểu thị mong muốn nhẹ nhàng; dùng 要 khi gọi món trực tiếp dứt khoát hơn.', exampleHanzi: '我想喝热茶。', examplePinyin: 'Wǒ xiǎng hē rè chá.', exampleVi: 'Tôi muốn uống trà nóng.' },
        { pattern: 'A 还是 B？(A hay là B?)', explanationVi: 'Dùng trong câu hỏi lựa chọn; không dùng 或者 cho câu hỏi lựa chọn.', exampleHanzi: '你吃米饭还是面条？', examplePinyin: 'Nǐ chī mǐfàn háishi miàntiáo?', exampleVi: 'Bạn ăn cơm hay mì?' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '大卫想喝什么？', questionPinyin: 'Dàwèi xiǎng hē shénme?', questionVi: 'David muốn uống gì?', sampleAnswerHanzi: '大卫想喝一杯热茶。', sampleAnswerPinyin: 'Dàwèi xiǎng hē yī bēi rè chá.', sampleAnswerVi: 'David muốn uống một cốc trà nóng.' },
        { id: 'q2', questionHanzi: '大卫觉得这个菜怎么样？', questionPinyin: 'Dàwèi juéde zhège cài zěnmeyàng?', questionVi: 'David cảm thấy món ăn này thế nào?', sampleAnswerHanzi: '他觉得这个菜很好吃。', sampleAnswerPinyin: 'Tā juéde zhège cài hěn hǎochī.', sampleAnswerVi: 'Anh ấy thấy món này rất ngon.' }
      ]
    }
  },
  {
    id: 'curated_hsk1_shop',
    level: 1,
    category: 'Mua sắm',
    title: '买水果 (Đi mua hoa quả)',
    targetWords: ['买', '苹果', '多少', '钱', '块', '太', '便宜'],
    content: {
      topic: 'Mua sắm',
      summaryVi: 'Hỏi giá tiền, số lượng và mua hoa quả tại chợ bằng các mẫu câu HSK 1 thiết yếu.',
      lines: [
        { speaker: '顾客', hanzi: '你好，我想买苹果。苹果多少钱一斤？', pinyin: 'Nǐ hǎo, wǒ xiǎng mǎi píngguǒ. Píngguǒ duōshao qián yī jīn?', translationVi: 'Chào chị, tôi muốn mua táo. Táo bao nhiêu tiền một cân (500g)?' },
        { speaker: '老板', hanzi: '苹果六块钱一斤，很甜！', pinyin: 'Píngguǒ liù kuài qián yī jīn, hěn tián!', translationVi: 'Táo 6 tệ một cân, ngọt lắm!' },
        { speaker: '顾客', hanzi: '太好了！我要三斤苹果，还要两个杯子。', pinyin: 'Tài hǎo le! Wǒ yào sān jīn píngguǒ, hái yào liǎng gè bēizi.', translationVi: 'Tuyệt quá! Tôi lấy 3 cân táo, lấy thêm hai cái cốc nữa.' },
        { speaker: '老板', hanzi: '一共三十八块钱。', pinyin: 'Yīgòng sānshíbā kuài qián.', translationVi: 'Tổng cộng hết 38 tệ.' },
        { speaker: '顾客', hanzi: '给你四十块。谢谢你！', pinyin: 'Gěi nǐ sìshí kuài. Xièxie nǐ!', translationVi: 'Gửi chị 40 tệ. Cảm ơn chị!' }
      ],
      grammarPoints: [
        { pattern: '多少钱 (Bao nhiêu tiền)', explanationVi: 'Dùng hỏi giá cả; đơn vị tiền tệ khẩu ngữ là 块 (kuài) thay cho 元 (yuán).', exampleHanzi: '这个杯子多少钱？', examplePinyin: 'Zhège bēizi duōshao qián?', exampleVi: 'Cái cốc này bao nhiêu tiền?' },
        { pattern: '太 + Tính từ + 了', explanationVi: 'Nhấn mạnh mức độ rất cao (quá tốt, quá đắt...).', exampleHanzi: '太好了！', examplePinyin: 'Tài hǎo le!', exampleVi: 'Tuyệt quá rồi!' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '苹果多少钱一斤？', questionPinyin: 'Píngguǒ duōshao qián yī jīn?', questionVi: 'Táo bao nhiêu tiền một cân?', sampleAnswerHanzi: '苹果六块钱一斤。', sampleAnswerPinyin: 'Píngguǒ liù kuài qián yī jīn.', sampleAnswerVi: 'Táo 6 tệ một cân.' },
        { id: 'q2', questionHanzi: '顾客一共花了多少钱？', questionPinyin: 'Gùkè yīgòng huāle duōshao qián?', questionVi: 'Khách hàng tổng cộng tiêu hết bao nhiêu tiền?', sampleAnswerHanzi: '一共三十八块钱。', sampleAnswerPinyin: 'Yīgòng sānshíbā kuài qián.', sampleAnswerVi: 'Tổng cộng 38 tệ.' }
      ]
    }
  },
  {
    id: 'curated_hsk1_travel',
    level: 1,
    category: 'Du lịch & Giao thông',
    title: '去北京看朋友 (Đi Bắc Kinh thăm bạn)',
    targetWords: ['去', '北京', '坐', '飞机', '出租车', '明天', '天气'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Hỏi phương tiện di chuyển, thời tiết và lịch trình chuyến đi cơ bản.',
      lines: [
        { speaker: '妈妈', hanzi: '明天你去哪儿？', pinyin: 'Míngtiān nǐ qù nǎr?', translationVi: 'Ngày mai con đi đâu?' },
        { speaker: '小明', hanzi: '明天我去北京看我的老师和朋友。', pinyin: 'Míngtiān wǒ qù Běijīng kàn wǒ de lǎoshī hé péngyou.', translationVi: 'Ngày mai con đi Bắc Kinh thăm thầy giáo và bạn bè của con.' },
        { speaker: '妈妈', hanzi: '你怎么去北京？坐火车还是坐飞机？', pinyin: 'Nǐ zěnme qù Běijīng? Zuò huǒchē háishi zuò fēijī?', translationVi: 'Con đi Bắc Kinh bằng gì? Đi tàu hỏa hay đi máy bay?' },
        { speaker: '小明', hanzi: '我坐飞机去，到了北京再坐出租车去学校。', pinyin: 'Wǒ zuò fēijī qù, dàole Běijīng zài zuò chūzūchē qù xuéxiào.', translationVi: 'Con đi máy bay, tới Bắc Kinh rồi đi taxi đến trường.' },
        { speaker: '妈妈', hanzi: '北京天气很冷，你要多穿衣服哦！', pinyin: 'Běijīng tiānqì hěn lěng, nǐ yào duō chuān yīfu o!', translationVi: 'Thời tiết Bắc Kinh rất lạnh, con nhớ mặc thêm áo nhé!' }
      ],
      grammarPoints: [
        { pattern: '坐 + Phương tiện + 去 + Địa điểm', explanationVi: 'Trật tự tiếng Trung đặt phương tiện TRƯỚC động từ đi/đến.', exampleHanzi: '我坐飞机去北京。', examplePinyin: 'Wǒ zuò fēijī qù Běijīng.', exampleVi: 'Tôi đi máy bay đến Bắc Kinh.' },
        { pattern: '怎么 + Động từ (Làm bằng cách nào)', explanationVi: 'Dùng để hỏi phương thức, phương tiện đi lại.', exampleHanzi: '你怎么去学校？', examplePinyin: 'Nǐ zěnme qù xuéxiào?', exampleVi: 'Bạn đi đến trường bằng cách nào?' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '小明怎么去北京？', questionPinyin: 'Xiǎomíng zěnme qù Běijīng?', questionVi: 'Tiểu Minh đi Bắc Kinh bằng phương tiện gì?', sampleAnswerHanzi: '小明坐飞机去北京。', sampleAnswerPinyin: 'Xiǎomíng zuò fēijī qù Běijīng.', sampleAnswerVi: 'Tiểu Minh đi máy bay đến Bắc Kinh.' },
        { id: 'q2', questionHanzi: '北京的天气怎么样？', questionPinyin: 'Běijīng de tiānqì zěnmeyàng?', questionVi: 'Thời tiết Bắc Kinh như thế nào?', sampleAnswerHanzi: '北京的天气很冷。', sampleAnswerPinyin: 'Běijīng de tiānqì hěn lěng.', sampleAnswerVi: 'Thời tiết Bắc Kinh rất lạnh.' }
      ]
    }
  },
  {
    id: 'curated_hsk1_study',
    level: 1,
    category: 'Học tập & Công việc',
    title: '我在学校学汉语 (Học tiếng Trung ở trường)',
    targetWords: ['学习', '汉语', '老师', '写', '汉字', '读', '书'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Kể về buổi học tiếng Trung, viết chữ Hán và đọc sách mỗi ngày.',
      lines: [
        { speaker: '王老师', hanzi: '同学们好！今天我们学习十个新汉字。', pinyin: 'Tóngxuémen hǎo! Jīntiān wǒmen xuéxí shí gè xīn Hànzì.', translationVi: 'Chào các em! Hôm nay chúng ta học 10 chữ Hán mới.' },
        { speaker: '安娜', hanzi: '老师，我喜欢听汉语，但是写汉字有点儿难。', pinyin: 'Lǎoshī, wǒ xǐhuan tīng Hànyǔ, dànshì xiě Hànzì yǒudiǎnr nán.', translationVi: 'Thưa cô, em thích nghe tiếng Trung nhưng viết chữ Hán hơi khó.' },
        { speaker: '王老师', hanzi: '没关系，每天多读课文、多写几遍就会了。', pinyin: 'Méi guānxi, měitiān duō dú kèwén, duō xiě jǐ biàn jiù huì le.', translationVi: 'Không sao đâu, mỗi ngày đọc bài khóa nhiều, viết thêm vài lượt là sẽ biết thôi.' },
        { speaker: '安娜', hanzi: '谢谢老师！晚上我在家看书和练习写字。', pinyin: 'Xièxie lǎoshī! Wǎnshang wǒ zài jiā kànshū hé liànxí xiězì.', translationVi: 'Em cảm ơn cô! Buổi tối em ở nhà đọc sách và luyện viết chữ.' }
      ],
      grammarPoints: [
        { pattern: '在 + Địa điểm + Động từ', explanationVi: 'Địa điểm xảy ra hành động luôn đặt TRƯỚC động từ trong tiếng Trung.', exampleHanzi: '我在家看书。', examplePinyin: 'Wǒ zài jiā kànshū.', exampleVi: 'Tôi đọc sách ở nhà.' },
        { pattern: '有点儿 + Tính từ', explanationVi: 'Nghĩa là "hơi...", thường dùng trước tính từ mang sắc thái không mong muốn (khó, mệt, đắt).', exampleHanzi: '写汉字有点儿难。', examplePinyin: 'Xiě Hànzì yǒudiǎnr nán.', exampleVi: 'Viết chữ Hán hơi khó.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '安娜觉得什么有点儿难？', questionPinyin: 'Ānnà juéde shénme yǒudiǎnr nán?', questionVi: 'Anna cảm thấy việc gì hơi khó?', sampleAnswerHanzi: '她觉得写汉字有点儿难。', sampleAnswerPinyin: 'Tā juéde xiě Hànzì yǒudiǎnr nán.', sampleAnswerVi: 'Cô ấy thấy viết chữ Hán hơi khó.' },
        { id: 'q2', questionHanzi: '安娜晚上在家做什么？', questionPinyin: 'Ānnà wǎnshang zài jiā zuò shénme?', questionVi: 'Buổi tối Anna làm gì ở nhà?', sampleAnswerHanzi: '她在家看书和练习写字。', sampleAnswerPinyin: 'Tā zài jiā kànshū hé liànxí xiězì.', sampleAnswerVi: 'Cô ấy ở nhà đọc sách và luyện viết chữ.' }
      ]
    }
  },

  // ==================== HSK 2 (5 bài) ====================
  {
    id: 'curated_hsk2_daily',
    level: 2,
    category: 'Sức khỏe & Đời sống',
    title: '每天早上跑步 (Thói quen chạy bộ buổi sáng)',
    targetWords: ['身体', '运动', '跑步', '起床', '休息', '已经', '帮助'],
    content: {
      topic: 'Sức khỏe & Đời sống',
      summaryVi: 'Trò chuyện về thói quen tập thể dục, dậy sớm và giữ gìn sức khỏe hàng ngày.',
      lines: [
        { speaker: '小李', hanzi: '你最近身体真好，每天都去运动吗？', pinyin: 'Nǐ zuìjìn shēntǐ zhēn hǎo, měitiān dōu qù yùndòng ma?', translationVi: 'Gần đây sức khỏe bạn tốt thật, ngày nào cũng đi tập thể dục à?' },
        { speaker: '小王', hanzi: '是啊，我每天早上六点起床，去公园跑步半个小时。', pinyin: 'Shì a, wǒ měitiān zǎoshang liù diǎn qǐchuáng, qù gōngyuán pǎobù bàn gè xiǎoshí.', translationVi: 'Đúng vậy, sáng nào mình cũng dậy lúc 6 giờ, ra công viên chạy bộ nửa tiếng.' },
        { speaker: '小李', hanzi: '你已经坚持多长时间了？', pinyin: 'Nǐ yǐjīng jiānchí duō cháng shíjiān le?', translationVi: 'Bạn đã kiên trì được bao lâu rồi?' },
        { speaker: '小王', hanzi: '已经三个月了。跑步对睡眠和工作都很有帮助。', pinyin: 'Yǐjīng sān gè yuè le. Pǎobù duì shuìmián hé gōngzuò dōu hěn yǒu bāngzhù.', translationVi: 'Đã ba tháng rồi. Chạy bộ rất có ích cho giấc ngủ và công việc.' },
        { speaker: '小李', hanzi: '太棒了！明天早上我跟你一起去吧。', pinyin: 'Tài bàng le! Míngtiān zǎoshang wǒ gēn nǐ yīqǐ qù ba.', translationVi: 'Tuyệt quá! Sáng mai mình đi cùng bạn nhé.' }
      ],
      grammarPoints: [
        { pattern: 'Động từ + Thời lượng (Khoảng thời gian)', explanationVi: 'Bổ ngữ thời lượng đặt sau động từ để nói làm việc gì trong bao lâu.', exampleHanzi: '跑步半个小时。', examplePinyin: 'Pǎobù bàn gè xiǎoshí.', exampleVi: 'Chạy bộ nửa tiếng.' },
        { pattern: '对 A 很有帮助', explanationVi: 'Nghĩa là "rất có ích / giúp ích nhiều cho A".', exampleHanzi: '运动对身体很有帮助。', examplePinyin: 'Yùndòng duì shēntǐ hěn yǒu bāngzhù.', exampleVi: 'Tập thể dục rất có ích cho sức khỏe.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '小王每天早上几点起床？', questionPinyin: 'Xiǎowáng měitiān zǎoshang jǐ diǎn qǐchuáng?', questionVi: 'Tiểu Vương mỗi sáng dậy lúc mấy giờ?', sampleAnswerHanzi: '他每天早上六点起床。', sampleAnswerPinyin: 'Tā měitiān zǎoshang liù diǎn qǐchuáng.', sampleAnswerVi: 'Anh ấy dậy lúc 6 giờ sáng mỗi ngày.' },
        { id: 'q2', questionHanzi: '小王已经坚持跑步多长时间了？', questionPinyin: 'Xiǎowáng yǐjīng jiānchí pǎobù duō cháng shíjiān le?', questionVi: 'Tiểu Vương đã kiên trì chạy bộ bao lâu rồi?', sampleAnswerHanzi: '已经三个月了。', sampleAnswerPinyin: 'Yǐjīng sān gè yuè le.', sampleAnswerVi: 'Đã ba tháng rồi.' }
      ]
    }
  },
  {
    id: 'curated_hsk2_restaurant',
    level: 2,
    category: 'Ăn uống',
    title: '一起去吃火锅 (Đi ăn lẩu cùng bạn bè)',
    targetWords: ['准备', '服务员', '便宜', '味道', '一起', '希望', '快乐'],
    content: {
      topic: 'Ăn uống',
      summaryVi: 'Rủ bạn cuối tuần đi ăn lẩu, chọn vị cay hay không cay và thanh toán tại nhà hàng.',
      lines: [
        { speaker: '小林', hanzi: '周末我们一起去那家新开的火锅店吃饭吧！', pinyin: 'Zhōumò wǒmen yīqǐ qù nà jiā xīn kāi de huǒguōdiàn chīfàn ba!', translationVi: 'Cuối tuần chúng ta cùng đến quán lẩu mới mở kia ăn nhé!' },
        { speaker: '阿明', hanzi: '好呀！听说那里的牛肉很新鲜，而且不太贵。', pinyin: 'Hǎo ya! Tīngshuō nàlǐ de niúròu hěn xīnxiān, érqiě bù tài guì.', translationVi: 'Được đấy! Nghe nói thịt bò ở đó rất tươi mà lại không quá đắt.' },
        { speaker: '小林', hanzi: '你能吃辣的吗？我们点鸳鸯锅怎么样？', pinyin: 'Nǐ néng chī là de ma? Wǒmen diǎn yuānyāngguō zěnmeyàng?', translationVi: 'Cậu ăn được cay không? Chúng mình gọi nồi lẩu hai ngăn nhé?' },
        { speaker: '阿明', hanzi: '太好了，一半辣的一半不辣的，大家都能吃。', pinyin: 'Tài hǎo le, yībàn là de yībàn bù là de, dàjiā dōu néng chī.', translationVi: 'Tuyệt quá, một nửa cay một nửa không cay, ai cũng ăn được.' },
        { speaker: '小林', hanzi: '那我提前给餐厅打电话订一个位置。', pinyin: 'Nà wǒ tíqián gěi cāntīng dǎ diànhuà dìng yī gè wèizhi.', translationVi: 'Vậy mình gọi điện đặt bàn trước với nhà hàng nhé.' }
      ],
      grammarPoints: [
        { pattern: '而且 (Hơn nữa, mà lại)', explanationVi: 'Nối hai vế bổ sung ý tiến tầng cho nhau.', exampleHanzi: '牛肉很新鲜，而且不贵。', examplePinyin: 'Niúròu hěn xīnxiān, érqiě bù guì.', exampleVi: 'Thịt bò rất tươi mà lại không đắt.' },
        { pattern: '给 + Ai + 打电话', explanationVi: 'Gọi điện thoại cho ai (đặt 给 + đối tượng trước 打电话).', exampleHanzi: '我给餐厅打电话。', examplePinyin: 'Wǒ gěi cāntīng dǎ diànhuà.', exampleVi: 'Tôi gọi điện cho nhà hàng.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '他们周末打算去哪儿吃饭？', questionPinyin: 'Tāmen zhōumò dǎsuàn qù nǎr chīfàn?', questionVi: 'Cuối tuần họ dự định đi ăn ở đâu?', sampleAnswerHanzi: '他们打算去新开的火锅店吃饭。', sampleAnswerPinyin: 'Tāmen dǎsuàn qù xīn kāi de huǒguōdiàn chīfàn.', sampleAnswerVi: 'Họ dự định đi ăn ở quán lẩu mới mở.' },
        { id: 'q2', questionHanzi: '为什么他们要点鸳鸯锅？', questionPinyin: 'Wèishénme tāmen yào diǎn yuānyāngguō?', questionVi: 'Tại sao họ muốn gọi lẩu hai ngăn?', sampleAnswerHanzi: '因为一半辣一半不辣，大家都能吃。', sampleAnswerPinyin: 'Yīnwèi yībàn là yībàn bù là, dàjiā dōu néng chī.', sampleAnswerVi: 'Vì một nửa cay một nửa không cay, mọi người đều ăn được.' }
      ]
    }
  },
  {
    id: 'curated_hsk2_shop',
    level: 2,
    category: 'Mua sắm',
    title: '试穿新衣服 (Thử áo và mặc cả)',
    targetWords: ['衣服', '颜色', '穿', '比', '贵', '便宜', '决定'],
    content: {
      topic: 'Mua sắm',
      summaryVi: 'Hỏi thử quần áo, so sánh màu sắc kích cỡ bằng câu chữ 比 và trả giá khéo léo.',
      lines: [
        { speaker: '顾客', hanzi: '你好，这件白色的衬衫可以试穿一下吗？', pinyin: 'Nǐ hǎo, zhè jiàn báisè de chènshān kěyǐ shìchuān yīxià ma?', translationVi: 'Chào bạn, chiếc áo sơ mi trắng này có thể mặc thử một chút không?' },
        { speaker: '店员', hanzi: '当然可以，试衣间在左边。', pinyin: 'Dāngrán kěyǐ, shìyījiān zài zuǒbiān.', translationVi: 'Đương nhiên được ạ, phòng thử đồ ở bên trái.' },
        { speaker: '顾客', hanzi: '这件穿起来很舒服，但是我觉得蓝色的比白色的更好看。', pinyin: 'Zhè jiàn chuān qǐlái hěn shūfu, dànshì wǒ juéde lánsè de bǐ báisè de gèng hǎokàn.', translationVi: 'Chiếc này mặc lên rất thoải mái, nhưng mình thấy màu xanh đẹp hơn màu trắng.' },
        { speaker: '店员', hanzi: '今天打八折，只要一百六十块钱。', pinyin: 'Jīntiān dǎ bā zhé, zhǐyào yībǎi liùshí kuài qián.', translationVi: 'Hôm nay giảm giá 20% (còn 8 phần), chỉ còn 160 tệ thôi ạ.' },
        { speaker: '顾客', hanzi: '好，那我买这件蓝色的吧！可以用手机付款吗？', pinyin: 'Hǎo, nà wǒ mǎi zhè jiàn lánsè de ba! Kěyǐ yòng shǒujī fùkuǎn ma?', translationVi: 'Được, vậy mình mua chiếc màu xanh này nhé! Có thể thanh toán bằng điện thoại không?' }
      ],
      grammarPoints: [
        { pattern: 'A 比 B (更) + Tính từ', explanationVi: 'Câu so sánh hơn cơ bản; lưu ý KHÔNG dùng 很 trong câu so sánh chữ 比, chỉ dùng 更 hoặc thêm số lượng phía sau.', exampleHanzi: '蓝色的比白色的更好看。', examplePinyin: 'Lánsè de bǐ báisè de gèng hǎokàn.', exampleVi: 'Chiếc màu xanh đẹp hơn chiếc màu trắng.' },
        { pattern: '打 X 折 (Giảm giá)', explanationVi: 'Cách tính giảm giá Trung Quốc ngược với Việt Nam: 打八折 = trả 80% (tức giảm 20%).', exampleHanzi: '今天打八折。', examplePinyin: 'Jīntiān dǎ bā zhé.', exampleVi: 'Hôm nay giảm 20%.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '顾客最后买了什么颜色的衬衫？', questionPinyin: 'Gùkè zuìhòu mǎile shénme yánsè de chènshān?', questionVi: 'Cuối cùng khách mua áo sơ mi màu gì?', sampleAnswerHanzi: '她买了蓝色的衬衫。', sampleAnswerPinyin: 'Tā mǎile lánsè de chènshān.', sampleAnswerVi: 'Cô ấy đã mua áo sơ mi màu xanh.' },
        { id: 'q2', questionHanzi: '打折以后衬衫多少钱？', questionPinyin: 'Dǎzhé yǐhòu chènshān duōshao qián?', questionVi: 'Sau khi giảm giá áo sơ mi bao nhiêu tiền?', sampleAnswerHanzi: '一百六十块钱。', sampleAnswerPinyin: 'Yībǎi liùshí kuài qián.', sampleAnswerVi: '160 tệ.' }
      ]
    }
  },
  {
    id: 'curated_hsk2_travel',
    level: 2,
    category: 'Du lịch & Giao thông',
    title: '请问地铁站怎么走 (Hỏi đường ra ga tàu điện ngầm)',
    targetWords: ['离', '远', '往', '左', '右', '公共汽车', '分钟'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Hỏi khoảng cách, chỉ đường rẽ trái/phải và đi thẳng ra ga tàu điện ngầm.',
      lines: [
        { speaker: '游客', hanzi: '打扰一下，请问最近的地铁站离这儿远吗？', pinyin: 'Dǎrǎo yīxià, qǐngwèn zuìjìn de dìtiězhàn lí zhèr yuǎn ma?', translationVi: 'Xin lỗi làm phiền chút, ga tàu điện ngầm gần nhất cách đây có xa không?' },
        { speaker: '路人', hanzi: '不远，走路大概十分钟就到了。', pinyin: 'Bù yuǎn, zǒulù dàgài shí fēnzhōng jiù dào le.', translationVi: 'Không xa đâu, đi bộ khoảng 10 phút là tới.' },
        { speaker: '游客', hanzi: '请问应该怎么走？', pinyin: 'Qǐngwèn yīnggāi zěnme zǒu?', translationVi: 'Xin hỏi nên đi như thế nào ạ?' },
        { speaker: '路人', hanzi: '你先一直往前走，到红绿灯那儿往右拐，就能看到地铁站。', pinyin: 'Nǐ xiān yīzhí wǎng qián zǒu, dào hónglǜdēng nàr wǎng yòu guǎi, jiù néng kàndào dìtiězhàn.', translationVi: 'Bạn cứ đi thẳng về phía trước, đến chỗ đèn giao thông rẽ phải là sẽ thấy ga tàu điện ngầm.' },
        { speaker: '游客', hanzi: '太清楚了，非常感谢你的帮助！', pinyin: 'Tài qīngchu le, fēicháng gǎnxiè nǐ de bāngzhù!', translationVi: 'Rõ ràng quá, vô cùng cảm ơn sự giúp đỡ của bạn!' }
      ],
      grammarPoints: [
        { pattern: 'A 离 B 远/近 (A cách B xa/gần)', explanationVi: 'Giới từ 离 biểu thị khoảng cách không gian hoặc thời gian giữa hai mốc.', exampleHanzi: '地铁站离这儿不远。', examplePinyin: 'Dìtiězhàn lí zhèr bù yuǎn.', exampleVi: 'Ga tàu điện ngầm cách đây không xa.' },
        { pattern: '往 + Hướng + 走/拐', explanationVi: 'Đi/rẽ về hướng nào (往前走 đi thẳng, 往右拐 rẽ phải, 往左拐 rẽ trái).', exampleHanzi: '往前走到路口往右拐。', examplePinyin: 'Wǎng qián zǒu dào lùkǒu wǎng yòu guǎi.', exampleVi: 'Đi thẳng đến ngã tư rẽ phải.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '走路去地铁站大概要多长时间？', questionPinyin: 'Zǒulù qù dìtiězhàn dàgài yào duō cháng shíjiān?', questionVi: 'Đi bộ ra ga tàu điện ngầm mất khoảng bao lâu?', sampleAnswerHanzi: '走路大概十分钟。', sampleAnswerPinyin: 'Zǒulù dàgài shí fēnzhōng.', sampleAnswerVi: 'Đi bộ khoảng 10 phút.' }
      ]
    }
  },
  {
    id: 'curated_hsk2_work',
    level: 2,
    category: 'Học tập & Công việc',
    title: '新公司的工作 (Công việc ở công ty mới)',
    targetWords: ['公司', '上班', '忙', '同事', '问题', '介绍', '休息'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Hỏi thăm bạn bè về môi trường làm việc, đồng nghiệp và lịch làm việc tại công ty mới.',
      lines: [
        { speaker: '小陈', hanzi: '你去新公司上班已经两周了，习惯了吗？', pinyin: 'Nǐ qù xīn gōngsī shàngbān yǐjīng liǎng zhōu le, xíguàn le ma?', translationVi: 'Bạn đi làm ở công ty mới được hai tuần rồi, quen chưa?' },
        { speaker: '小敏', hanzi: '基本习惯了！虽然工作有点儿忙，但是同事们都很热情。', pinyin: 'Jīběn xíguàn le! Suīrán gōngzuò yǒudiǎnr máng, dànshì tóngshìmen dōu hěn rèqíng.', translationVi: 'Cơ bản quen rồi! Tuy công việc hơi bận nhưng các đồng nghiệp đều rất nhiệt tình.' },
        { speaker: '小陈', hanzi: '遇到不懂的问题时，有人帮你吗？', pinyin: 'Yùdào bù dǒng de wèntí shí, yǒu rén bāng nǐ ma?', translationVi: 'Khi gặp vấn đề không hiểu có ai giúp bạn không?' },
        { speaker: '小敏', hanzi: '有啊，经理耐心地给我介绍了整个项目的流程。', pinyin: 'Yǒu a, jīnglǐ nàixīn de gěi wǒ jièshàole zhěnggè xiàngmù de liúchéng.', translationVi: 'Có chứ, quản lý đã kiên nhẫn giới thiệu cho mình quy trình cả dự án.' }
      ],
      grammarPoints: [
        { pattern: '虽然……，但是…… (Tuy... nhưng...)', explanationVi: 'Cặp liên từ biểu thị quan hệ chuyển ngoặt; tiếng Trung có thể dùng cả 2 vế cùng lúc (khác tiếng Anh).', exampleHanzi: '虽然很忙，但是很开心。', examplePinyin: 'Suīrán hěn máng, dànshì hěn kāixīn.', exampleVi: 'Tuy rất bận nhưng rất vui.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '小敏觉得新公司的同事怎么样？', questionPinyin: 'Xiǎomǐn juéde xīn gōngsī de tóngshì zěnmeyàng?', questionVi: 'Tiểu Mẫn cảm thấy đồng nghiệp ở công ty mới thế nào?', sampleAnswerHanzi: '同事们都很热情。', sampleAnswerPinyin: 'Tóngshìmen dōu hěn rèqíng.', sampleAnswerVi: 'Các đồng nghiệp đều rất nhiệt tình.' }
      ]
    }
  },

  // ==================== HSK 3 (5 bài) ====================
  {
    id: 'curated_hsk3_hotel',
    level: 3,
    category: 'Du lịch & Giao thông',
    title: '办理酒店入住 (Làm thủ tục nhận phòng khách sạn)',
    targetWords: ['护照', '预订', '房间', '安静', '电梯', '包括', '满意'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Check-in khách sạn, yêu cầu phòng yên tĩnh, hỏi bữa sáng và mật khẩu Wi-Fi.',
      lines: [
        { speaker: '前台', hanzi: '欢迎光临！请问您预订房间了吗？', pinyin: 'Huānyíng guānglín! Qǐngwèn nín yùdìng fángjiān le ma?', translationVi: 'Chào mừng quý khách! Xin hỏi quý khách đã đặt phòng chưa ạ?' },
        { speaker: '旅客', hanzi: '预订了，我叫陈明。这是我的护照。', pinyin: 'Yùdìng le, wǒ jiào Chén Míng. Zhè shì wǒ de hùzhào.', translationVi: 'Đặt rồi ạ, tôi tên là Trần Minh. Đây là hộ chiếu của tôi.' },
        { speaker: '前台', hanzi: '查到了，您订的是三晚的大床房，包含免费早餐。', pinyin: 'Chádào le, nín dìng de shì sān wǎn de dàchuángfáng, bāohán miǎnfèi zǎocān.', translationVi: 'Đã tìm thấy rồi ạ, anh đặt phòng giường lớn 3 đêm, bao gồm bữa sáng miễn phí.' },
        { speaker: '旅客', hanzi: '麻烦帮我安排一间安静一点儿的房间，最好离电梯远一点儿。', pinyin: 'Máfan bāng wǒ ānpái yī jiān ānjìng yīdiǎnr de fángjiān, zuìhǎo lí diàntī yuǎn yīdiǎnr.', translationVi: 'Phiền bạn sắp giúp tôi một phòng yên tĩnh một chút, tốt nhất là xa thang máy chút.' },
        { speaker: '前台', hanzi: '没问题，给您安排八楼的房间。这是您的房卡，祝您入住愉快！', pinyin: 'Méi wèntí, gěi nín ānpái bā lóu de fángjiān. Zhè shì nín de fángkǎ, zhù nín rùzhù yúkuài!', translationVi: 'Không vấn đề gì, xin sắp cho anh phòng ở tầng 8. Đây là thẻ phòng của anh, chúc anh lưu trú vui vẻ!' }
      ],
      grammarPoints: [
        { pattern: '麻烦 + (帮我) + Động từ', explanationVi: 'Cách nhờ vả lịch sự rất phổ biến trong giao tiếp đời sống Trung Quốc.', exampleHanzi: '麻烦帮我拿一下房卡。', examplePinyin: 'Máfan bāng wǒ ná yīxià fángkǎ.', exampleVi: 'Phiền bạn lấy giúp tôi thẻ phòng một chút.' },
        { pattern: 'Tính từ + 一点儿', explanationVi: 'Biểu thị mong muốn mức độ hơn một chút (yên tĩnh hơn chút, rẻ hơn chút).', exampleHanzi: '安静一点儿的房间。', examplePinyin: 'Ānjìng yīdiǎnr de fángjiān.', exampleVi: 'Phòng yên tĩnh hơn một chút.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '陈明订的房间包括早餐吗？', questionPinyin: 'Chén Míng dìng de fángjiān bāokuò zǎocān ma?', questionVi: 'Phòng Trần Minh đặt có bao gồm bữa sáng không?', sampleAnswerHanzi: '包括免费早餐。', sampleAnswerPinyin: 'Bāokuò miǎnfèi zǎocān.', sampleAnswerVi: 'Có bao gồm bữa sáng miễn phí.' }
      ]
    }
  },
  {
    id: 'curated_hsk3_health',
    level: 3,
    category: 'Sức khỏe & Đời sống',
    title: '感冒去看医生 (Bị cảm đi khám bác sĩ)',
    targetWords: ['感冒', '发烧', '检查', '药', '注意', '多喝水', '照顾'],
    content: {
      topic: 'Sức khỏe & Đời sống',
      summaryVi: 'Mô tả triệu chứng cảm cúm, nghe bác sĩ kê đơn thuốc và dặn dò cách nghỉ ngơi.',
      lines: [
        { speaker: '医生', hanzi: '你好，你哪儿不舒服？', pinyin: 'Nǐ hǎo, nǐ nǎr bù shūfu?', translationVi: 'Chào bạn, bạn thấy khó chịu ở đâu?' },
        { speaker: '病人', hanzi: '从昨天晚上开始，我一直头疼、咳嗽，好像还有点儿发烧。', pinyin: 'Cóng zuótiān wǎnshang kāishǐ, wǒ yīzhí tóuténg, késou, hǎoxiàng hái yǒudiǎnr fāshāo.', translationVi: 'Từ tối hôm qua tôi cứ đau đầu, ho, hình như còn hơi sốt nữa.' },
        { speaker: '医生', hanzi: '我先给你量一下体温。三十八度二，确实发烧了，是普通感冒。', pinyin: 'Wǒ xiān gěi nǐ liáng yīxià tǐwēn. Sānshíbā dù èr, quèshí fāshāo le, shì pǔtōng gǎnmào.', translationVi: 'Để tôi đo nhiệt độ trước. 38,2 độ, đúng là sốt rồi, là cảm cúm thông thường.' },
        { speaker: '病人', hanzi: '需要打针吗？这药怎么吃？', pinyin: 'Xūyào dǎzhēn ma? Zhè yào zěnme chī?', translationVi: 'Có cần tiêm không bác sĩ? Thuốc này uống thế nào ạ?' },
        { speaker: '医生', hanzi: '不用打针。饭后吃药，一天三次。最近要注意休息，多喝热水。', pinyin: 'Bùyòng dǎzhēn. Fànhòu chīyào, yī tiān sān cì. Zuìjìn yào zhùyì xiūxi, duō hē rèshuǐ.', translationVi: 'Không cần tiêm. Uống thuốc sau bữa ăn, ngày 3 lần. Mấy hôm nay nhớ chú ý nghỉ ngơi, uống nhiều nước ấm.' }
      ],
      grammarPoints: [
        { pattern: '从……开始 (Bắt đầu từ...)', explanationVi: 'Chỉ mốc thời gian hoặc điểm khởi đầu của trạng thái/hành động.', exampleHanzi: '从昨天晚上开始发烧。', examplePinyin: 'Cóng zuótiān wǎnshang kāishǐ fāshāo.', exampleVi: 'Bắt đầu sốt từ tối hôm qua.' },
        { pattern: '一直 + Động từ (Liên tục, suốt)', explanationVi: 'Nhấn mạnh trạng thái diễn ra kéo dài không ngừng.', exampleHanzi: '我一直咳嗽。', examplePinyin: 'Wǒ yīzhí késou.', exampleVi: 'Tôi ho liên tục.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '医生建议病人怎么吃药？', questionPinyin: 'Yīshēng jiànyì bìngrén zěnme chīyào?', questionVi: 'Bác sĩ khuyên bệnh nhân uống thuốc thế nào?', sampleAnswerHanzi: '饭后吃药，一天三次。', sampleAnswerPinyin: 'Fànhòu chīyào, yī tiān sān cì.', sampleAnswerVi: 'Uống thuốc sau bữa ăn, một ngày 3 lần.' }
      ]
    }
  },
  {
    id: 'curated_hsk3_online_shop',
    level: 3,
    category: 'Mua sắm',
    title: '网上购物和快递 (Mua sắm online & giao hàng)',
    targetWords: ['选择', '方便', '比较', '评价', '快递', '如果', '退货'],
    content: {
      topic: 'Mua sắm',
      summaryVi: 'Thảo luận về việc xem đánh giá sản phẩm, tốc độ giao hàng và đổi trả khi mua online.',
      lines: [
        { speaker: '小芳', hanzi: '你这个新书包真好看，是在商场买的吗？', pinyin: 'Nǐ zhège xīn shūbāo zhēn hǎokàn, shì zài shāngchǎng mǎi de ma?', translationVi: 'Chiếc balo mới này của bạn đẹp quá, mua ở trung tâm thương mại à?' },
        { speaker: '小军', hanzi: '不是，是在网上买的。网上的选择多，价格也比较便宜。', pinyin: 'Bù shì, shì zài wǎngshàng mǎi de. Wǎngshàng de xuǎnzé duō, jiàgé yě bǐjiào piányi.', translationVi: 'Không phải, mua trên mạng đấy. Trên mạng nhiều lựa chọn, giá cũng khá rẻ.' },
        { speaker: '小芳', hanzi: '你买之前会看其他买家的评价吗？', pinyin: 'Nǐ mǎi zhīqián huì kàn qítā mǎijiā de píngjià ma?', translationVi: 'Trước khi mua bạn có xem đánh giá của người mua khác không?' },
        { speaker: '小军', hanzi: '当然会！而且现在快递特别快，昨天刚下单，今天下午就送到了。', pinyin: 'Dāngrán huì! Érqiě xiànzài kuàidì tèbié kuài, zuótiān gāng xiàdān, jīntiān xiàwǔ jiù sòngdào le.', translationVi: 'Chắc chắn có chứ! Hơn nữa giờ giao hàng cực nhanh, hôm qua mới đặt mà chiều nay đã giao tới rồi.' },
        { speaker: '小芳', hanzi: '如果质量不满意，还能免费退货，真的很方便！', pinyin: 'Rúguǒ zhìliàng bù mǎnyì, hái néng miǎnfèi tuìhuò, zhēnde hěn fāngbiàn!', translationVi: 'Nếu chất lượng không hài lòng còn được trả hàng miễn phí, tiện thật đấy!' }
      ],
      grammarPoints: [
        { pattern: '是……的 (Nhấn mạnh nơi chốn/thời gian/cách thức của việc đã xảy ra)', explanationVi: 'Cấu trúc 是...的 dùng để nhấn mạnh chi tiết của một hành động trong quá khứ.', exampleHanzi: '这个书包是在网上买的。', examplePinyin: 'Zhège shūbāo shì zài wǎngshàng mǎi de.', exampleVi: 'Chiếc balo này là mua ở trên mạng đấy.' },
        { pattern: '如果……，就/还…… (Nếu... thì...)', explanationVi: 'Câu điều kiện giả thiết tiêu chuẩn trong HSK 3.', exampleHanzi: '如果不满意，可以退货。', examplePinyin: 'Rúguǒ bù mǎnyì, kěyǐ tuìhuò.', exampleVi: 'Nếu không hài lòng thì có thể trả hàng.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '为什么小军喜欢在网上购物？', questionPinyin: 'Wèishénme Xiǎojūn xǐhuan zài wǎngshàng gòuwù?', questionVi: 'Tại sao Tiểu Quân thích mua sắm trên mạng?', sampleAnswerHanzi: '因为网上选择多、价格便宜，而且快递很快。', sampleAnswerPinyin: 'Yīnwèi wǎngshàng xuǎnzé duō, jiàgé piányi, érqiě kuàidì hěn kuài.', sampleAnswerVi: 'Vì trên mạng nhiều lựa chọn, giá rẻ mà giao hàng lại rất nhanh.' }
      ]
    }
  },
  {
    id: 'curated_hsk3_study',
    level: 3,
    category: 'Học tập & Công việc',
    title: '准备HSK考试的秘诀 (Bí quyết ôn thi HSK hiệu quả)',
    targetWords: ['习惯', '复习', '提高', '水平', '方法', '坚持', '成绩'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Chia sẻ kinh nghiệm học từ vựng theo ngữ cảnh và luyện nghe nói để đạt điểm cao HSK.',
      lines: [
        { speaker: '同学A', hanzi: '恭喜你通过了HSK三级考试，而且成绩这么高！', pinyin: 'Gōngxǐ nǐ tōngguòle HSK sānjí kǎoshì, érqiě chéngjì zhème gāo!', translationVi: 'Chúc mừng bạn đã đỗ kỳ thi HSK 3 mà điểm lại cao thế này!' },
        { speaker: '同学B', hanzi: '谢谢！其实最重要的是找到适合自己的学习方法。', pinyin: 'Xièxie! Qíshí zuì zhòngyào de shì zhǎodào shìhé zìjǐ de xuéxí fāngfǎ.', translationVi: 'Cảm ơn nhé! Thực ra quan trọng nhất là tìm được phương pháp học phù hợp với bản thân.' },
        { speaker: '同学A', hanzi: '你平时怎么记生词？我老是背了就忘。', pinyin: 'Nǐ píngshí zěnme jì shēngcí? Wǒ lǎoshì bèile jiù wàng.', translationVi: 'Bình thường bạn nhớ từ mới thế nào? Mình cứ học thuộc rồi lại quên.' },
        { speaker: '同学B', hanzi: '不要死记硬背！把容易忘的词放进课文和句子里，每天复习十五分钟，水平很快就会提高。', pinyin: 'Bùyào sǐjìyìngbèi! Bǎ róngyì wàng de cí fàngjìn kèwén hé jùzi lǐ, měitiān fùxí shíwǔ fēnzhōng, shuǐpíng hěn kuài jiù huì tígāo.', translationVi: 'Đừng học vẹt! Hãy đưa các từ hay quên vào bài khóa và câu văn, mỗi ngày ôn 15 phút là trình độ sẽ tăng rất nhanh.' }
      ],
      grammarPoints: [
        { pattern: '把 + Tân ngữ + Động từ + Thành phần khác', explanationVi: 'Câu chữ 把 nhấn mạnh việc tác động làm thay đổi vị trí hoặc trạng thái của đối tượng.', exampleHanzi: '把生词放进句子里。', examplePinyin: 'Bǎ shēngcí fàngjìn jùzi lǐ.', exampleVi: 'Đưa từ mới vào trong câu.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '同学B建议怎么记住容易忘的词？', questionPinyin: 'Tóngxué B jiànyì zěnme jìzhù róngyì wàng de cí?', questionVi: 'Bạn B khuyên cách nào để nhớ các từ hay quên?', sampleAnswerHanzi: '把容易忘的词放进课文和句子里每天复习。', sampleAnswerPinyin: 'Bǎ róngyì wàng de cí fàngjìn kèwén hé jùzi lǐ měitiān fùxí.', sampleAnswerVi: 'Đưa các từ hay quên vào bài khóa và câu để ôn mỗi ngày.' }
      ]
    }
  },
  {
    id: 'curated_hsk3_social',
    level: 3,
    category: 'Giao tiếp',
    title: '邀请朋友来家里做客 (Mời bạn đến nhà chơi)',
    targetWords: ['邀请', '客人', '打扫', '拿手菜', '礼物', '客气', '热情'],
    content: {
      topic: 'Giao tiếp',
      summaryVi: 'Cách mời khách đến nhà ăn cơm và phép lịch sự khi mang quà, khen chủ nhà nấu ăn ngon.',
      lines: [
        { speaker: '主人', hanzi: '欢迎欢迎！快请进，路上堵车了吗？', pinyin: 'Huānyíng huānyíng! Kuài qǐng jìn, lùshang dǔchē le ma?', translationVi: 'Chào mừng! Mau vào nhà đi, trên đường có bị tắc đường không?' },
        { speaker: '客人', hanzi: '没堵车，很顺利。这是我带的一点儿水果，请收下！', pinyin: 'Méi dǔchē, hěn shùnlì. Zhè shì wǒ dài de yīdiǎnr shuǐguǒ, qǐng shōuxià!', translationVi: 'Không tắc đâu, đi thuận lợi lắm. Đây là chút hoa quả mình mang tới, bạn nhận lấy nhé!' },
        { speaker: '主人', hanzi: '你太客气了，人来就好了，还带什么礼物呀！', pinyin: 'Nǐ tài kèqi le, rén lái jiù hǎo le, hái dài shénme lǐwù ya!', translationVi: 'Bạn khách sáo quá, đến chơi là vui rồi còn mang quà làm gì!' },
        { speaker: '客人', hanzi: '哇，你做了一大桌子菜，看起来太香了！', pinyin: 'Wa, nǐ zuòle yī dà zhuōzi cài, kàn qǐlái tài xiāng le!', translationVi: 'Oa, bạn nấu cả một bàn đầy món ăn, trông thơm ngon quá!' },
        { speaker: '主人', hanzi: '别客气，把这儿当自己家，多吃点儿！', pinyin: 'Bié kèqi, bǎ zhèr dāng zìjǐ jiā, duō chī diǎnr!', translationVi: 'Đừng ngại nhé, cứ coi đây như nhà mình, ăn nhiều vào!' }
      ],
      grammarPoints: [
        { pattern: '把 A 当 (作) B', explanationVi: 'Coi A như là B.', exampleHanzi: '把这儿当自己家。', examplePinyin: 'Bǎ zhèr dāng zìjǐ jiā.', exampleVi: 'Coi đây như nhà của chính mình.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '客人来主人家带了什么礼物？', questionPinyin: 'Kèrén lái zhǔrén jiā dàile shénme lǐwù?', questionVi: 'Khách đến nhà chủ đã mang theo quà gì?', sampleAnswerHanzi: '客人带了一点儿水果。', sampleAnswerPinyin: 'Kèrén dàile yīdiǎnr shuǐguǒ.', sampleAnswerVi: 'Khách đã mang theo một ít hoa quả.' }
      ]
    }
  },

  // ==================== HSK 4 (5 bài) ====================
  {
    id: 'curated_hsk4_interview',
    level: 4,
    category: 'Học tập & Công việc',
    title: '中文求职面试 (Phỏng vấn xin việc bằng tiếng Trung)',
    targetWords: ['面试', '经验', '专业', '能力', '沟通', '负责', '机会'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Trả lời các câu hỏi kinh điển khi phỏng vấn: giới thiệu bản thân, thế mạnh và lý do ứng tuyển.',
      lines: [
        { speaker: '面试官', hanzi: '你好！请先简单介绍一下你的工作经验吧。', pinyin: 'Nǐ hǎo! Qǐng xiān jiǎndān jièshào yīxià nǐ de gōngzuò jīngyàn ba.', translationVi: 'Chào bạn! Trước tiên hãy giới thiệu ngắn gọn kinh nghiệm làm việc của bạn nhé.' },
        { speaker: '应聘者', hanzi: '您好！我大学学的是国际贸易专业，毕业后在一家外贸公司负责客户沟通。', pinyin: 'Nín hǎo! Wǒ dàxué xué de shì guójì màoyì zhuānyè, bìyè hòu zài yī jiā wàimào gōngsī fùzé kèhù gōutōng.', translationVi: 'Chào anh/chị! Đại học tôi học chuyên ngành Thương mại Quốc tế, sau khi tốt nghiệp tôi phụ trách giao tiếp khách hàng tại một công ty xuất nhập khẩu.' },
        { speaker: '面试官', hanzi: '你认为自己最大的优势是什么？', pinyin: 'Nǐ rènwéi zìjǐ zuìdà de yōushì shì shénme?', translationVi: 'Bạn cho rằng ưu thế lớn nhất của bản thân là gì?' },
        { speaker: '应聘者', hanzi: '我不仅汉语流利，而且适应能力强，面对压力也能冷静解决问题。', pinyin: 'Wǒ bùjǐn Hànyǔ liúlì, érqiě shìyìng nénglì qiáng, miànduì yālì yě néng lěngjìng jiějué wèntí.', translationVi: 'Tôi không chỉ thông thạo tiếng Trung mà còn có khả năng thích nghi tốt, đối mặt áp lực vẫn bình tĩnh giải quyết vấn đề.' },
        { speaker: '面试官', hanzi: '很好，如果有进一步的消息，我们会在三天内通知你。', pinyin: 'Hěn hǎo, rúguǒ yǒu jìnyībù de xiāoxi, wǒmen huì zài sān tiān nèi tōngzhī nǐ.', translationVi: 'Rất tốt, nếu có thông tin tiếp theo chúng tôi sẽ thông báo cho bạn trong vòng 3 ngày.' }
      ],
      grammarPoints: [
        { pattern: '不仅……，而且…… (Không chỉ... mà còn...)', explanationVi: 'Cấu trúc tăng tiến trang trọng, rất hay ghi điểm trong phỏng vấn và viết luận HSK 4.', exampleHanzi: '他不仅汉语流利，而且工作认真。', examplePinyin: 'Tā bùjǐn Hànyǔ liúlì, érqiě gōngzuò rènzhēn.', exampleVi: 'Anh ấy không chỉ nói tiếng Trung lưu loát mà còn làm việc nghiêm túc.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '应聘者认为自己最大的优势是什么？', questionPinyin: 'Yìngpìnzhě rènwéi zìjǐ zuìdà de yōushì shì shénme?', questionVi: 'Ứng viên cho rằng ưu thế lớn nhất của mình là gì?', sampleAnswerHanzi: '汉语流利、适应能力强，面对压力能冷静解决问题。', sampleAnswerPinyin: 'Hànyǔ liúlì, shìyìng nénglì qiáng, miànduì yālì néng lěngjìng jiějué wèntí.', sampleAnswerVi: 'Tiếng Trung lưu loát, thích nghi tốt và bình tĩnh xử lý vấn đề dưới áp lực.' }
      ]
    }
  },
  {
    id: 'curated_hsk4_food_culture',
    level: 4,
    category: 'Ăn uống',
    title: '南北饮食文化的差异 (Sự khác biệt ẩm thực Nam – Bắc)',
    targetWords: ['文化', '特点', '区别', '习惯', '丰富', '印象', '品尝'],
    content: {
      topic: 'Ăn uống',
      summaryVi: 'Khám phá nét đặc sắc giữa ẩm thực miền Bắc và miền Nam Trung Quốc.',
      lines: [
        { speaker: '小赵', hanzi: '你去过那么多中国城市，哪个地方的菜给你印象最深？', pinyin: 'Nǐ qùguò nàme duō Zhōngguó chéngshì, nǎge dìfang de cài gěi nǐ yìnxiàng zuì shēn?', translationVi: 'Bạn đã đi qua nhiều thành phố Trung Quốc vậy, ẩm thực nơi nào để lại ấn tượng sâu nhất cho bạn?' },
        { speaker: '阿华', hanzi: '我觉得南北方的饮食文化区别很大。北方人喜欢吃面食和饺子，味道偏咸。', pinyin: 'Wǒ juéde nánběifāng de yǐnshí wénhuà qūbié hěn dà. Běifāngrén xǐhuan chī miànshí hé jiǎozi, wèidào piān xián.', translationVi: 'Mình thấy văn hóa ẩm thực Nam Bắc khác nhau lắm. Người miền Bắc thích ăn món bột mì và sủi cảo, vị hơi đậm mặn.' },
        { speaker: '小赵', hanzi: '没错！而南方人以米饭为主，像广东菜讲究清淡鲜美，四川菜则又麻又辣。', pinyin: 'Méicuò! Ér nánfāngrén yǐ mǐfàn wéizhǔ, xiàng Guǎngdōng cài jiǎngjiu qīngdàn xiānměi, Sìchuān cài zé yòu má yòu là.', translationVi: 'Chuẩn luôn! Còn người miền Nam lấy cơm làm chính, như món Quảng Đông chú trọng thanh đạm tươi ngọt, còn món Tứ Xuyên thì vừa tê vừa cay.' },
        { speaker: '阿华', hanzi: '下次有机会，我一定要亲自去成都品尝最正宗的川菜！', pinyin: 'Xià cì yǒu jīhuì, wǒ yīdìng yào qīnzì qù Chéngdū pǐncháng zuì zhèngzōng de Chuāncài!', translationVi: 'Lần sau có cơ hội, mình nhất định phải đích thân tới Thành Đô thưởng thức món Tứ Xuyên chuẩn vị nhất!' }
      ],
      grammarPoints: [
        { pattern: '以 A 为主 (Lấy A làm chính)', explanationVi: 'Cấu trúc văn viết & khẩu ngữ trang trọng chỉ yếu tố chủ đạo.', exampleHanzi: '南方人以米饭为主。', examplePinyin: 'Nánfāngrén yǐ mǐfàn wéizhǔ.', exampleVi: 'Người miền Nam lấy cơm làm món chính.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '广东菜和四川菜各有什么特点？', questionPinyin: 'Guǎngdōng cài hé Sìchuān cài gè yǒu shénme tèdiǎn?', questionVi: 'Món Quảng Đông và món Tứ Xuyên có đặc điểm gì?', sampleAnswerHanzi: '广东菜清淡鲜美，四川菜又麻又辣。', sampleAnswerPinyin: 'Guǎngdōng cài qīngdàn xiānměi, Sìchuān cài yòu má yòu là.', sampleAnswerVi: 'Món Quảng Đông thanh đạm tươi ngon, món Tứ Xuyên vừa tê vừa cay.' }
      ]
    }
  },
  {
    id: 'curated_hsk4_travel',
    level: 4,
    category: 'Du lịch & Giao thông',
    title: '高铁改变了出行方式 (Tàu cao tốc thay đổi cách đi lại)',
    targetWords: ['发展', '速度', '准时', '风景', '省时间', '舒适', '计划'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Trải nghiệm đi tàu cao tốc xuyên tỉnh ở Trung Quốc: nhanh, đúng giờ và ngắm cảnh đẹp.',
      lines: [
        { speaker: '导游', hanzi: '现在去上海，大家更愿意坐高铁还是坐飞机？', pinyin: 'Xiànzài qù Shànghǎi, dàjiā gèng yuànyì zuò gāotiě háishi zuò fēijī?', translationVi: 'Bây giờ đi Thượng Hải, mọi người thích đi tàu cao tốc hay máy bay hơn?' },
        { speaker: '游客', hanzi: '我肯定选高铁！高铁不仅速度快，而且几乎从来不晚点，非常准时。', pinyin: 'Wǒ kěndìng xuǎn gāotiě! Gāotiě bùjǐn sùdù kuài, érqiě jīhū cónglái bù wǎndiǎn, fēicháng zhǔnshí.', translationVi: 'Tôi chắc chắn chọn tàu cao tốc! Tàu cao tốc không chỉ nhanh mà hầu như không bao giờ trễ chuyến, cực kỳ đúng giờ.' },
        { speaker: '导游', hanzi: '是的，从北京到上海一千三百多公里，坐高铁只需要四个半小时左右。', pinyin: 'Shì de, cóng Běijīng dào Shànghǎi yīqiān sānbǎi duō gōnglǐ, zuò gāotiě zhǐ xūyào sì gè bàn xiǎoshí zuǒyòu.', translationVi: 'Đúng vậy, từ Bắc Kinh đến Thượng Hải hơn 1.300 km, đi tàu cao tốc chỉ mất khoảng 4 tiếng rưỡi.' },
        { speaker: '游客', hanzi: '座位也很宽敞舒适，还能一边喝咖啡，一边欣赏窗外的风景。', pinyin: 'Zuòwèi yě hěn kuānchang shūshì, hái néng yībiān hē kāfēi, yībiān xīnshǎng chuāngwài de fēngjǐng.', translationVi: 'Ghế ngồi cũng rộng rãi thoải mái, lại vừa uống cà phê vừa ngắm phong cảnh ngoài cửa sổ được.' }
      ],
      grammarPoints: [
        { pattern: '一边 A，一边 B (Vừa làm A vừa làm B)', explanationVi: 'Diễn tả hai hành động diễn ra song song cùng lúc.', exampleHanzi: '一边喝咖啡，一边看风景。', examplePinyin: 'Yībiān hē kāfēi, yībiān kàn fēngjǐng.', exampleVi: 'Vừa uống cà phê vừa ngắm cảnh.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '为什么游客更愿意坐高铁去上海？', questionPinyin: 'Wèishénme yóukè gèng yuànyì zuò gāotiě qù Shànghǎi?', questionVi: 'Tại sao du khách thích đi tàu cao tốc tới Thượng Hải hơn?', sampleAnswerHanzi: '因为高铁速度快、非常准时，而且座位宽敞舒适。', sampleAnswerPinyin: 'Yīnwèi gāotiě sùdù kuài, fēicháng zhǔnshí, érqiě zuòwèi kuānchang shūshì.', sampleAnswerVi: 'Vì tàu cao tốc nhanh, rất đúng giờ và ghế ngồi rộng rãi thoải mái.' }
      ]
    }
  },
  {
    id: 'curated_hsk4_shopping',
    level: 4,
    category: 'Mua sắm',
    title: '理性消费不冲动 (Tiêu dùng lý trí, tránh mua sắm bốc đồng)',
    targetWords: ['消费', '打折', '广告', '浪费', '考虑', '实用', '节省'],
    content: {
      topic: 'Mua sắm',
      summaryVi: 'Bàn về mẹo chi tiêu thông minh vào các dịp khuyến mãi lớn để tránh lãng phí.',
      lines: [
        { speaker: '小丽', hanzi: '双十一促销快到了，你的购物车里加满东西了吗？', pinyin: 'Shuāngshíyī cùxiāo kuài dào le, nǐ de gòuwùchē lǐ jiāmǎn dōngxi le ma?', translationVi: 'Đợt sale 11/11 sắp tới rồi, giỏ hàng của cậu đã đầy ắp đồ chưa?' },
        { speaker: '小宇', hanzi: '以前我一看到打折广告就忍不住买，结果买回来的很多东西根本用不上。', pinyin: 'Yǐqián wǒ yī kàndào dǎzhé guǎnggào jiù rěnbuzhù mǎi, jiéguǒ mǎi huílái de hěnduō dōngxi gēnběn yòngbushàng.', translationVi: 'Trước kia mình cứ thấy quảng cáo giảm giá là không kìm được mua ngay, kết quả nhiều thứ mua về chẳng dùng tới.' },
        { speaker: '小丽', hanzi: '那你现在怎么控制自己呢？', pinyin: 'Nà nǐ xiànzài zěnme kòngzhì zìjǐ ne?', translationVi: 'Thế giờ cậu kiểm soát bản thân bằng cách nào?' },
        { speaker: '小宇', hanzi: '我现在会先冷静考虑三天，只买真正实用的必需品，这样反而节省了不少钱。', pinyin: 'Wǒ xiànzài huì xiān lěngjìng kǎolǜ sān tiān, zhǐ mǎi zhēnzhèng shíyòng de bìxūpǐn, zhèyàng fǎnér jiéshěngle bùshǎo qián.', translationVi: 'Giờ mình cứ bình tĩnh suy nghĩ 3 ngày trước, chỉ mua đồ thiết yếu thực sự hữu dụng, thế lại tiết kiệm được khá nhiều tiền.' }
      ],
      grammarPoints: [
        { pattern: '一……就…… (Hễ... là lập tức...)', explanationVi: 'Biểu thị hai hành động nối tiếp nhau tức thì hoặc quan hệ điều kiện nhanh.', exampleHanzi: '一看到打折就想买。', examplePinyin: 'Yī kàndào dǎzhé jiù xiǎng mǎi.', exampleVi: 'Hễ thấy giảm giá là muốn mua ngay.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '小宇现在用什么方法避免冲动消费？', questionPinyin: 'Xiǎoyǔ xiànzài yòng shénme fāngfǎ bìmiǎn chōngdòng xiāofèi?', questionVi: 'Tiểu Vũ hiện dùng cách gì để tránh mua sắm bốc đồng?', sampleAnswerHanzi: '他先冷静考虑三天，只买真正实用的必需品。', sampleAnswerPinyin: 'Tā xiān lěngjìng kǎolǜ sān tiān, zhǐ mǎi zhēnzhèng shíyòng de bìxūpǐn.', sampleAnswerVi: 'Cậu ấy bình tĩnh cân nhắc 3 ngày, chỉ mua những đồ thiết yếu thực dụng.' }
      ]
    }
  },
  {
    id: 'curated_hsk4_life',
    level: 4,
    category: 'Sức khỏe & Đời sống',
    title: '放下手机早点睡 (Đặt điện thoại xuống và ngủ sớm)',
    targetWords: ['熬夜', '影响', '效率', '精力', '改变', '养成', '健康'],
    content: {
      topic: 'Sức khỏe & Đời sống',
      summaryVi: 'Tác hại của việc thức khuya lướt điện thoại và cách xây dựng thói quen nghỉ ngơi khoa học.',
      lines: [
        { speaker: '小雅', hanzi: '你今天看起来有点儿没精神，昨晚又熬夜了吗？', pinyin: 'Nǐ jīntiān kàn qǐlái yǒudiǎnr méi jīngshén, zuówǎn yòu áoyè le ma?', translationVi: 'Hôm nay trông cậu hơi thiếu sức sống, tối qua lại thức khuya à?' },
        { speaker: '阿凯', hanzi: '唉，本来十一点就躺下了，结果刷短视频不知不觉就到了凌晨一点。', pinyin: 'Āi, běnlái shíyī diǎn jiù tǎngxià le, jiéguǒ shuā duǎnshìpín bùzhībùjué jiù dàole língchén yī diǎn.', translationVi: 'Haiz, vốn 11 giờ đã nằm rồi, kết quả lướt video ngắn bất giác đến tận 1 giờ sáng.' },
        { speaker: '小雅', hanzi: '长期熬夜不仅影响白天的工作效率，还会让记忆力下降。', pinyin: 'Chángqī áoyè bùjǐn yǐngxiǎng báitiān de gōngzuò xiàolǜ, hái huì ràng jìyìlì xiàjiàng.', translationVi: 'Thức khuya kéo dài không chỉ ảnh hưởng hiệu suất làm việc ban ngày mà còn làm suy giảm trí nhớ.' },
        { speaker: '阿凯', hanzi: '你说得对！从今晚起，我十点半就把手机放到客厅去，养成早睡早起的好习惯。', pinyin: 'Nǐ shuō de duì! Cóng jīnwǎn qǐ, wǒ shí diǎn bàn jiù bǎ shǒujī fàngdào kètīng qù, yǎngchéng zǎoshuì zǎoqǐ de hǎo xíguàn.', translationVi: 'Cậu nói đúng đấy! Từ tối nay 10 rưỡi mình sẽ để điện thoại ra phòng khách, rèn thói quen ngủ sớm dậy sớm.' }
      ],
      grammarPoints: [
        { pattern: '本来……，结果…… (Vốn dĩ..., kết quả lại...)', explanationVi: 'Diễn tả sự việc diễn biến khác với dự định ban đầu.', exampleHanzi: '本来想早睡，结果熬夜了。', examplePinyin: 'Běnlái xiǎng zǎoshuì, jiéguǒ áoyè le.', exampleVi: 'Vốn định ngủ sớm, kết quả lại thức khuya.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '长期熬夜会带来什么坏处？', questionPinyin: 'Chángqī áoyè huì dàilái shénme huàichu?', questionVi: 'Thức khuya lâu dài mang lại tác hại gì?', sampleAnswerHanzi: '会影响工作效率，还会让记忆力下降。', sampleAnswerPinyin: 'Huì yǐngxiǎng gōngzuò xiàolǜ, hái huì ràng jìyìlì xiàjiàng.', sampleAnswerVi: 'Sẽ ảnh hưởng hiệu suất công việc và làm giảm trí nhớ.' }
      ]
    }
  },

  // ==================== HSK 5 (5 bài) ====================
  {
    id: 'curated_hsk5_ai_work',
    level: 5,
    category: 'Học tập & Công việc',
    title: '人工智能与未来职场 (Trí tuệ nhân tạo & nghề nghiệp tương lai)',
    targetWords: ['人工智能', '代替', '创造力', '趋势', '掌握', '合作', '竞争'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Thảo luận sâu sắc về cách AI hỗ trợ công việc và những kỹ năng con người cần rèn luyện.',
      lines: [
        { speaker: '主持人', hanzi: '随着人工智能技术的迅速发展，很多人担心自己的工作会被机器代替。您怎么看？', pinyin: 'Suízhe réngōng zhìnéng jìshù de xùnsù fāzhǎn, hěnduō rén dānxīn zìjǐ de gōngzuò huì bèi jīqì dàitì. Nín zěnme kàn?', translationVi: 'Cùng với sự phát triển nhanh chóng của công nghệ AI, nhiều người lo lắng công việc của mình sẽ bị máy móc thay thế. Ông nhìn nhận thế nào?' },
        { speaker: '专家', hanzi: '事实上，AI更像是一个高效的助手，它可以帮我们处理重复性的任务，从而释放更多时间。', pinyin: 'Shìshí shàng, AI gèng xiàng shì yī gè gāoxiào de zhùshǒu, tā kěyǐ bāng wǒmen chǔlǐ chóngfùxìng de rènwu, cóngér shìfàng gèng duō shíjiān.', translationVi: 'Trên thực tế, AI giống một trợ lý hiệu suất cao hơn, nó giúp ta xử lý các tác vụ lặp lại, qua đó giải phóng thêm nhiều thời gian.' },
        { speaker: '主持人', hanzi: '那么，未来职场最看重哪些人类独有的能力呢？', pinyin: 'Nàme, wèilái zhíchǎng zuì kànzhòng nǎxiē rénlèi dúyǒu de nénglì ne?', translationVi: 'Vậy môi trường công việc tương lai coi trọng nhất những năng lực độc hữu nào của con người?' },
        { speaker: '专家', hanzi: '创造力、批判性思维以及人与人之间的深度共情，这些都是算法难以完全取代的。懂得善用工具的人，才会在竞争中脱颖而出。', pinyin: 'Chuàngzàolì, pīpànxìng sīwéi yǐjí rén yǔ rén zhījiān de shēndù gòngqíng, zhèxiē dōu shì suànfǎ nányǐ wánquán qǔdài de. Dǒngde shànyòng gōngjù de rén, cái huì zài jìngzhēng zhōng tuōyǐngérchū.', translationVi: 'Sức sáng tạo, tư duy phản biện và sự thấu cảm sâu sắc giữa người với người đều là điều thuật toán khó thay thế hoàn toàn. Người biết khéo léo tận dụng công cụ mới nổi bật trong cạnh tranh.' }
      ],
      grammarPoints: [
        { pattern: '随着……，…… (Cùng với sự biến đổi của..., thì...)', explanationVi: 'Cấu trúc chuẩn HSK 5 diễn tả sự thay đổi kéo theo của một xu hướng.', exampleHanzi: '随着科技的发展，生活越来越便利。', examplePinyin: 'Suízhe kējì de fāzhǎn, shēnghuó yuèláiyuè biànlì.', exampleVi: 'Cùng với sự phát triển khoa học công nghệ, cuộc sống ngày càng tiện lợi.' },
        { pattern: '从而 (Qua đó, từ đó dẫn tới)', explanationVi: 'Liên từ văn viết nối phương thức/nguyên nhân với kết quả tích cực tiếp theo.', exampleHanzi: '节省了时间，从而提高了效率。', examplePinyin: 'Jiéshěngle shíjiān, cóngér tígāole xiàolǜ.', exampleVi: 'Tiết kiệm được thời gian, từ đó nâng cao hiệu suất.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '专家认为哪些能力是AI难以完全取代的？', questionPinyin: 'Zhuānjiā rènwéi nǎxiē nénglì shì AI nányǐ wánquán qǔdài de?', questionVi: 'Chuyên gia cho rằng những năng lực nào AI khó thay thế hoàn toàn?', sampleAnswerHanzi: '创造力、批判性思维以及人与人之间的深度共情。', sampleAnswerPinyin: 'Chuàngzàolì, pīpànxìng sīwéi yǐjí rén yǔ rén zhījiān de shēndù gòngqíng.', sampleAnswerVi: 'Sức sáng tạo, tư duy phản biện và sự thấu cảm sâu sắc giữa con người.' }
      ]
    }
  },
  {
    id: 'curated_hsk5_tea',
    level: 5,
    category: 'Ăn uống',
    title: '中国茶道与慢生活 (Trà đạo Trung Hoa & nghệ thuật sống chậm)',
    targetWords: ['讲究', '品茶', '悠久', '心态', '浮躁', '放松', '享受'],
    content: {
      topic: 'Ăn uống',
      summaryVi: 'Tìm hiểu tinh thần thưởng trà Trung Hoa như một cách tĩnh tâm giữa nhịp sống đô thị hối hả.',
      lines: [
        { speaker: '茶艺师', hanzi: '中国的茶文化历史悠久，从茶叶的采摘到冲泡的水温，每一步都十分讲究。', pinyin: 'Zhōngguó de chá wénhuà lìshǐ yōujiǔ, cóng cháyè de cǎizhāi dào chōngpào de shuǐwēn, měi yī bù dōu shífēn jiǎngjiu.', translationVi: 'Văn hóa trà Trung Quốc có lịch sử lâu đời, từ khâu hái lá trà tới nhiệt độ nước pha, mỗi bước đều vô cùng cầu kỳ.' },
        { speaker: '访客', hanzi: '在快节奏的现代社会里，为什么依然有这么多年轻人爱上了喝茶？', pinyin: 'Zài kuàijiézòu de xiàndài shèhuì lǐ, wèishénme yīrán yǒu zhème duō niánqīngrén àishàngle hēchá?', translationVi: 'Trong xã hội hiện đại nhịp sống gấp gáp, vì sao vẫn có nhiều người trẻ yêu thích uống trà đến thế?' },
        { speaker: '茶艺师', hanzi: '因为喝茶不仅是为了解渴，更是一种让浮躁的心态慢下来的方式。', pinyin: 'Yīnwèi hēchá bùjǐn shì wèile jiěkě, gèng shì yī zhǒng ràng fúzào de xīntài màn xiàlái de fāngshì.', translationVi: 'Bởi vì uống trà không chỉ để giải khát, mà còn là một cách giúp tâm trạng xao động chậm lại.' },
        { speaker: '访客', hanzi: '闻着淡淡的茶香，确实让人感到格外放松，仿佛所有的烦恼都暂时消失了。', pinyin: 'Wénzhe dàndàn de cháxiāng, quèshí ràng rén gǎndào géwài fàngsōng, fǎngfú suǒyǒu de fánnǎo dōu zànshí xiāoshī le.', translationVi: 'Ngửi hương trà thoang thoảng quả thực khiến người ta thấy thư thái lạ thường, dường như mọi muộn phiền tạm tan biến.' }
      ],
      grammarPoints: [
        { pattern: '不仅是为了 A，更是 B', explanationVi: 'Nâng tầng mục đích từ bề nổi lên giá trị tinh thần sâu xa hơn.', exampleHanzi: '学习不仅是为了考试，更是为了开阔眼界。', examplePinyin: 'Xuéxí bùjǐn shì wèile kǎoshì, gèng shì wèile kāikuò yǎnjiè.', exampleVi: 'Học tập không chỉ vì thi cử, mà hơn thế là để mở mang tầm mắt.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '茶艺师认为年轻人爱上喝茶的原因是什么？', questionPinyin: 'Cháyìshī rènwéi niánqīngrén àishàng hēchá de yuányīn shì shénme?', questionVi: 'Nghệ nhân trà cho rằng nguyên nhân người trẻ yêu thích uống trà là gì?', sampleAnswerHanzi: '喝茶能让浮躁的心态慢下来，让人感到放松。', sampleAnswerPinyin: 'Hēchá néng ràng fúzào de xīntài màn xiàlái, ràng rén gǎndào fàngsōng.', sampleAnswerVi: 'Uống trà giúp tâm trạng nôn nóng chậm lại và mang lại cảm giác thư thái.' }
      ]
    }
  },
  {
    id: 'curated_hsk5_negotiation',
    level: 5,
    category: 'Giao tiếp',
    title: '商务合作与双赢谈判 (Đàm phán hợp tác kinh doanh đôi bên cùng có lợi)',
    targetWords: ['合作', '方案', '诚意', '条件', '利润', '达成', '共赢'],
    content: {
      topic: 'Giao tiếp',
      summaryVi: 'Hội thoại thương lượng điều khoản giao hàng và chiết khấu hướng tới hợp tác lâu dài.',
      lines: [
        { speaker: '王总', hanzi: '李经理，我们对贵公司提出的新方案非常感兴趣，只是报价略高于我们的预算。', pinyin: 'Wáng zǒng: Lǐ jīnglǐ, wǒmen duì guì gōngsī tíchū de xīn fāngàn fēicháng gǎnxìngqù, zhǐshì bàojià lüè gāoyú wǒmen de yùsuàn.', translationVi: 'Giám đốc Lý, chúng tôi rất hứng thú với phương án mới của quý công ty, chỉ là báo giá hơi cao hơn ngân sách của chúng tôi một chút.' },
        { speaker: '李经理', hanzi: '理解您的顾虑。考虑到我们双方长期合作的诚意，如果订单量能增加百分之二十，我们愿意给予相应的折扣。', pinyin: 'Lǐjiě nín de gùlǜ. Kǎolǜ dào wǒmen shuāngfāng chángqī hézuò de chéngyì, rúguǒ dìngdānliàng néng zēngjiā bǎifēnzhī èrshí, wǒmen yuànyì jǐyǔ xiāngyìng de zhékòu.', translationVi: 'Tôi hiểu băn khoăn của anh. Xét thiện chí hợp tác lâu dài giữa hai bên, nếu lượng đơn tăng 20%, chúng tôi sẵn sàng dành mức chiết khấu tương ứng.' },
        { speaker: '王总', hanzi: '这个提议很合理！只要交货周期和售后质量有保障，我们很快就能达成共识。', pinyin: 'Zhège tíyì hěn hélǐ! Zhǐyào jiāohuò zhōuqī hé shòuhòu zhìliàng yǒu bǎozhàng, wǒmen hěn kuài jiù néng dáchéng gòngshí.', translationVi: 'Đề xuất này rất hợp lý! Chỉ cần tiến độ giao hàng và chất lượng hậu mãi được đảm bảo, chúng ta sẽ sớm đạt được đồng thuận.' },
        { speaker: '李经理', hanzi: '太好了，期待我们携手实现真正的互利共赢！', pinyin: 'Tài hǎo le, qīdài wǒmen xiéshǒu shíxiàn zhēnzhèng de hùlì gòngyíng!', translationVi: 'Tuyệt vời, mong chờ hai bên cùng chung tay đạt được hợp tác đôi bên cùng có lợi!' }
      ],
      grammarPoints: [
        { pattern: '只要……，就…… (Chỉ cần... thì...)', explanationVi: 'Biểu thị điều kiện đủ để đạt được kết quả mong muốn.', exampleHanzi: '只要质量有保障，我们就能签约。', examplePinyin: 'Zhǐyào zhìliàng yǒu bǎozhàng, wǒmen jiù néng qiānyuē.', exampleVi: 'Chỉ cần chất lượng đảm bảo, chúng tôi sẽ ký hợp đồng ngay.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '在什么条件下，李经理愿意给予折扣？', questionPinyin: 'Zài shénme tiáojiàn xià, Lǐ jīnglǐ yuànyì jǐyǔ zhékòu?', questionVi: 'Trong điều kiện nào giám đốc Lý sẵn sàng chiết khấu?', sampleAnswerHanzi: '如果订单量能增加百分之二十。', sampleAnswerPinyin: 'Rúguǒ dìngdānliàng néng zēngjiā bǎifēnzhī èrshí.', sampleAnswerVi: 'Nếu khối lượng đơn hàng tăng thêm 20%.' }
      ]
    }
  },
  {
    id: 'curated_hsk5_eco_travel',
    level: 5,
    category: 'Du lịch & Giao thông',
    title: '绿色低碳旅行 (Du lịch xanh & bảo vệ môi trường)',
    targetWords: ['环保', '污染', '自然', '尊重', '减少', '责任', '体验'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Xu hướng du lịch có trách nhiệm: giảm rác thải nhựa và tôn trọng hệ sinh thái địa phương.',
      lines: [
        { speaker: '小苏', hanzi: '如今越来越多的人在规划旅行时，开始注重环保与可持续发展。', pinyin: 'Rújīn yuèláiyuè duō de rén zài guīhuà lǚxíng shí, kāishǐ zhùzhòng huánbǎo yǔ kěchíxù fāzhǎn.', translationVi: 'Ngày nay càng nhiều người khi lên kế hoạch du lịch bắt đầu chú trọng bảo vệ môi trường và phát triển bền vững.' },
        { speaker: '小文', hanzi: '确实如此。比如自带水杯和布袋，尽量选择公共交通，这些小举动就能大大减少塑料污染。', pinyin: 'Quèshí rúcǐ. Bǐrú zìdài shuǐbēi hé bùdài, jǐnliàng xuǎnzé gōnggòng jiāotōng, zhèxiē xiǎo jǔdòng jiù néng dàdà jiǎnshǎo sùliào wūrǎn.', translationVi: 'Đúng thật. Ví dụ tự mang bình nước và túi vải, cố gắng đi phương tiện công cộng, những hành động nhỏ này đã giảm đáng kể ô nhiễm nhựa.' },
        { speaker: '小苏', hanzi: '同时，走进自然景区时尊重当地风俗、不乱扔垃圾，也是每位游客应尽的责任。', pinyin: 'Tóngshí, zǒujìn zìrán jǐngqū shí zūnzhòng dāngdì fēngsú, bù luàn rēng lājī, yě shì měi wèi yóukè yīngjìn de zérèn.', translationVi: 'Đồng thời, khi tới khu danh thắng thiên nhiên biết tôn trọng phong tục bản địa, không xả rác bừa bãi cũng là trách nhiệm mỗi du khách nên làm.' }
      ],
      grammarPoints: [
        { pattern: '尽量 + Động từ (Cố gắng hết sức...)', explanationVi: 'Nhấn mạnh nỗ lực đạt mức tối đa trong phạm vi có thể.', exampleHanzi: '尽量选择公共交通。', examplePinyin: 'Jǐnliàng xuǎnzé gōnggòng jiāotōng.', exampleVi: 'Cố gắng tối đa chọn phương tiện giao thông công cộng.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '文中有哪些减少塑料污染的小举动？', questionPinyin: 'Wénzhōng yǒu nǎxiē jiǎnshǎo sùliào wūrǎn de xiǎo jǔdòng?', questionVi: 'Trong bài nêu những hành động nhỏ nào giúp giảm ô nhiễm nhựa?', sampleAnswerHanzi: '自带水杯和布袋，尽量选择公共交通。', sampleAnswerPinyin: 'Zìdài shuǐbēi hé bùdài, jǐnliàng xuǎnzé gōnggòng jiāotōng.', sampleAnswerVi: 'Tự mang bình nước, túi vải và ưu tiên giao thông công cộng.' }
      ]
    }
  },
  {
    id: 'curated_hsk5_mental',
    level: 5,
    category: 'Sức khỏe & Đời sống',
    title: '学会与压力和平共处 (Học cách chung sống hòa bình với áp lực)',
    targetWords: ['压力', '情绪', '调节', '倾诉', '平衡', '积极', '乐观'],
    content: {
      topic: 'Sức khỏe & Đời sống',
      summaryVi: 'Cách điều tiết cảm xúc, giữ cân bằng công việc – cuộc sống và tư duy tích cực.',
      lines: [
        { speaker: '心理师', hanzi: '现代人几乎都面临来自工作或家庭的压力，完全消除压力并不现实，关键在于如何调节情绪。', pinyin: 'Xiàndàirén jīhū dōu miànlín láizì gōngzuò huò jiātíng de yālì, wánquán xiāochú yālì bìng bù xiànshí, guānjiàn zàiyú rúhé tiáojié qíngxù.', translationVi: 'Người hiện đại hầu như đều đối mặt áp lực từ công việc hay gia đình; xóa bỏ hoàn toàn áp lực là bất khả thi, mấu chốt nằm ở cách điều tiết cảm xúc.' },
        { speaker: '来访者', hanzi: '当我感到焦虑的时候，总是控制不住胡思乱想，越想越累。', pinyin: 'Dāng wǒ gǎndào jiāolǜ de shíhou, zǒngshì kòngzhì bù zhù húsīluànxiǎng, yuè xiǎng yuè lèi.', translationVi: 'Khi tôi thấy lo âu, tôi luôn không ngăn được mình suy nghĩ miên man, càng nghĩ càng mệt.' },
        { speaker: '心理师', hanzi: '这时不妨把担忧写下来，或者找信赖的朋友倾诉，把大问题拆分成一个个可以立刻执行的小步骤。', pinyin: 'Zhè shí bùfáng bǎ dānyōu xiě xiàlái, huòzhě zhǎo xìnlài de péngyou qīngsù, bǎ dà wèntí chāifēn chéng yīgègè kěyǐ lìkè zhíxíng de xiǎo bùzhòu.', translationVi: 'Lúc đó hãy thử viết nỗi lo ra giấy hoặc tâm sự với người bạn tin cậy, chia nhỏ vấn đề lớn thành từng bước nhỏ làm được ngay.' }
      ],
      grammarPoints: [
        { pattern: '关键在于…… (Mấu chốt nằm ở...)', explanationVi: 'Cấu trúc lập luận rất hay dùng trong bài nghị luận và giao tiếp nâng cao.', exampleHanzi: '成功的关键在于坚持。', examplePinyin: 'Chénggōng de guānjiàn zàiyú jiānchí.', exampleVi: 'Chìa khóa thành công nằm ở sự kiên trì.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '心理师建议焦虑时可以怎么做？', questionPinyin: 'Xīnlǐshī jiànyì jiāolǜ shí kěyǐ zěnme zuò?', questionVi: 'Chuyên gia tâm lý khuyên nên làm gì khi lo âu?', sampleAnswerHanzi: '把担忧写下来、找朋友倾诉，并把大问题拆分成小步骤。', sampleAnswerPinyin: 'Bǎ dānyōu xiě xiàlái, zhǎo péngyou qīngsù, bìng bǎ dà wèntí chāifēn chéng xiǎo bùzhòu.', sampleAnswerVi: 'Viết nỗi lo ra, tâm sự với bạn và chia vấn đề lớn thành các bước nhỏ.' }
      ]
    }
  },

  // ==================== HSK 6 (5 bài) ====================
  {
    id: 'curated_hsk6_learning',
    level: 6,
    category: 'Học tập & Công việc',
    title: '终身学习与认知升级 (Học tập suốt đời & nâng cấp tư duy)',
    targetWords: ['终身', '迭代', '局限', '汲取', '融会贯通', '洞察', '核心'],
    content: {
      topic: 'Học tập & Công việc',
      summaryVi: 'Bài luận ngắn HSK 6 bàn về tốc độ cập nhật tri thức trong kỷ nguyên số và năng lực tự học bền vững.',
      lines: [
        { speaker: '演讲者', hanzi: '在知识更新日新月异的时代，毕业早已不再意味着学习的终点，而恰恰是终身学习的起点。', pinyin: 'Zài zhīshi gēngxīn rìxīnyuèyì de shídài, bìyè zǎoyǐ bùzài yìwèizhe xuéxí de zhōngdiǎn, ér qiàqià shì zhōngshēn xuéxí de qǐdiǎn.', translationVi: 'Trong thời đại tri thức đổi mới từng ngày, tốt nghiệp từ lâu không còn là điểm kết thúc của việc học mà chính là vạch xuất phát của học tập suốt đời.' },
        { speaker: '演讲者', hanzi: '面对海量的碎片化信息，如果我们只停留在浅层浏览，就很难形成系统性的认知框架。', pinyin: 'Miànduì hǎiliàng de suìpiànhuà xìnxī, rúguǒ wǒmen zhǐ tíngliú zài qiǎncéng liúlǎn, jiù hěn nán xíngchéng xìtǒngxìng de rènzhī kuàngjià.', translationVi: 'Trước biển thông tin mảnh vụn, nếu chỉ dừng ở việc lướt đọc hời hợt thì rất khó xây dựng khung nhận thức mang tính hệ thống.' },
        { speaker: '演讲者', hanzi: '唯有不断跳出舒适区，将跨学科的思维融会贯通，并在实践中反复验证，才能真正突破自身的局限。', pinyin: 'Wéiyǒu bùduàn tiàochū shūshìqū, jiāng kuàxuékē de sīwéi rónghuìguàntōng, bìng zài shíjiàn zhōng fǎnfù yànzhèng, cái néng zhēnzhèng tūpò zìshēn de júxiàn.', translationVi: 'Chỉ có không ngừng bước ra khỏi vùng an toàn, dung hợp nhuần nhuyễn tư duy liên ngành và kiểm chứng liên tục qua thực tiễn mới thực sự vượt qua giới hạn bản thân.' }
      ],
      grammarPoints: [
        { pattern: '唯有……，才…… (Chỉ duy có... mới có thể...)', explanationVi: 'Cấu trúc văn viết trang trọng tương đương 只有...才... nhưng sắc thái nhấn mạnh cao hơn.', exampleHanzi: '唯有坚持实践，才能融会贯通。', examplePinyin: 'Wéiyǒu jiānchí shíjiàn, cái néng rónghuìguàntōng.', exampleVi: 'Chỉ có kiên trì thực hành mới có thể thấu hiểu nhuần nhuyễn.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '为什么碎片化浏览难以形成系统认知？', questionPinyin: 'Wèishénme suìpiànhuà liúlǎn nányǐ xíngchéng xìtǒng rènzhī?', questionVi: 'Tại sao việc lướt thông tin vụn vặt khó hình thành nhận thức hệ thống?', sampleAnswerHanzi: '因为只停留在浅层浏览，缺乏深入思考与实践验证。', sampleAnswerPinyin: 'Yīnwèi zhǐ tíngliú zài qiǎncéng liúlǎn, quēfá shēnrù sīkǎo yǔ shíjiàn yànzhèng.', sampleAnswerVi: 'Vì chỉ dừng ở mức lướt bề mặt, thiếu suy ngẫm sâu và kiểm chứng thực tế.' }
      ]
    }
  },
  {
    id: 'curated_hsk6_ecommerce',
    level: 6,
    category: 'Mua sắm',
    title: '直播电商的兴起与规范 (Sự trỗi dậy & chuẩn hóa thương mại livestream)',
    targetWords: ['兴起', '透明', '口碑', '监管', '信赖', '长远', '生态'],
    content: {
      topic: 'Mua sắm',
      summaryVi: 'Phân tích ưu nhược điểm của mua sắm livestream và vai trò của chữ tín đối với thương hiệu.',
      lines: [
        { speaker: '评论员', hanzi: '近年来，直播电商凭借直观的互动体验迅速兴起，彻底重构了消费者与品牌之间的连接方式。', pinyin: 'Jìnniánlái, zhíbō diànshāng píngjiè zhíguān de hùdòng tǐyàn xùnsù xīngqǐ, chèdǐ chónggòule xiāofèizhě yǔ pǐnpái zhījiān de liánjiē fāngshì.', translationVi: 'Những năm gần đây, thương mại livestream nhờ trải nghiệm tương tác trực quan đã trỗi dậy nhanh chóng, tái cấu trúc hoàn toàn cách kết nối giữa người tiêu dùng và thương hiệu.' },
        { speaker: '评论员', hanzi: '然而，在流量红利逐渐见顶的背景下，部分夸大宣传的现象一度引发了消费者的信任危机。', pinyin: 'Ránér, zài liúliàng hónglì zhújiàn jiàndǐng de bèijǐng xià, bùfen kuādà xuānchuán de xiànxiàng yīdù yǐnfāle xiāofèizhě de xìnrèn wēijī.', translationVi: 'Tuy nhiên, trong bối cảnh lợi thế lưu lượng dần chạm đỉnh, hiện tượng quảng cáo phóng đại ở một bộ phận từng gây ra khủng hoảng niềm tin nơi người mua.' },
        { speaker: '评论员', hanzi: '由此可见，唯有严把品控关、坚持透明诚信，才能赢得持久的口碑，推动行业走向健康长远的生态。', pinyin: 'Yóucǐ kějiàn, wéiyǒu yán bǎ pǐnkòng guān, jiānchí tòumíng chéngxìn, cái néng yíngdé chíjiǔ de kǒubēi, tuīdòng hángyè zǒuxiàng jiànkāng chángyuǎn de shēngtài.', translationVi: 'Từ đó thấy rõ, chỉ khi kiểm soát chặt chất lượng và giữ vững minh bạch uy tín mới giành được tiếng thơm bền vững, đưa ngành phát triển lành mạnh lâu dài.' }
      ],
      grammarPoints: [
        { pattern: '凭借 + Ưu thế/Phương tiện (Dựa vào, nhờ vào)', explanationVi: 'Giới từ HSK 6 chỉ điều kiện hoặc ưu thế làm nền tảng dẫn đến thành công.', exampleHanzi: '凭借优质服务赢得客户信赖。', examplePinyin: 'Píngjiè yōuzhì fúwù yíngdé kèhù xìnlài.', exampleVi: 'Nhờ dịch vụ chất lượng cao mà giành được sự tin cậy của khách hàng.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '直播电商要实现长远发展最核心的前提是什么？', questionPinyin: 'Zhíbō diànshāng yào shíxiàn chángyuǎn fāzhǎn zuì héxīn de qiántí shì shénme?', questionVi: 'Tiền đề cốt lõi để thương mại livestream phát triển lâu dài là gì?', sampleAnswerHanzi: '严把品控关并坚持透明诚信。', sampleAnswerPinyin: 'Yán bǎ pǐnkòng guān bìng jiānchí tòumíng chéngxìn.', sampleAnswerVi: 'Kiểm soát chặt chất lượng và kiên trì minh bạch, giữ chữ tín.' }
      ]
    }
  },
  {
    id: 'curated_hsk6_comm',
    level: 6,
    category: 'Giao tiếp',
    title: '高情商沟通的艺术 (Nghệ thuật giao tiếp EQ cao)',
    targetWords: ['倾听', '立场', '措辞', '分歧', '尊重', '委婉', '化解'],
    content: {
      topic: 'Giao tiếp',
      summaryVi: 'Cách lắng nghe sâu, diễn đạt khéo léo và hóa giải bất đồng trong môi trường chuyên nghiệp.',
      lines: [
        { speaker: '导师', hanzi: '许多人误以为高情商就是一味迎合别人，其实恰恰相反，真正的沟通高手懂得在坚持原则的同时照顾对方的感受。', pinyin: 'Xǔduō rén wùyǐwéi gāo qíngshāng jiùshì yīwèi yínghé biérén, qíshí qiàqià xiāngfǎn, zhēnzhèng de gōutōng gāoshǒu dǒngde zài jiānchí yuánzé de tóngshí zhàogù duìfāng de gǎnshòu.', translationVi: 'Nhiều người lầm tưởng EQ cao là chỉ biết chiều lòng người khác; kỳ thực ngược lại, bậc thầy giao tiếp thực thụ biết vừa giữ vững nguyên tắc vừa tôn trọng cảm xúc đối phương.' },
        { speaker: '导师', hanzi: '面对观点分歧时，先真诚地倾听并复述对方的立场，往往能瞬间消解大部分抵触情绪。', pinyin: 'Miànduì guāndiǎn fēnqí shí, xiān zhēnchéng de qīngtīng bìng fùshù duìfāng de lìchǎng, wǎngwǎng néng shùnjiān xiāojiě dàbùfen dǐchù qíngxù.', translationVi: 'Khi gặp bất đồng quan điểm, trước hết hãy chân thành lắng nghe và tóm lược lại lập trường của đối phương, điều này thường lập tức hóa giải phần lớn tâm lý phòng thủ.' },
        { speaker: '导师', hanzi: '用建设性的措辞替代指责，将“你做错了”转化为“我们如何改进”，问题便迎刃而解。', pinyin: 'Yòng jiànshèxìng de cuòcí tìdài zhǐzé, jiāng "nǐ zuòcuò le" zhuǎnhuà wéi "wǒmen rúhé gǎijìn", wèntí biàn yíngrènérjiě.', translationVi: 'Dùng ngôn từ mang tính xây dựng thay cho trách móc, chuyển "bạn làm sai rồi" thành "chúng ta cải thiện thế nào", vấn đề sẽ được giải quyết êm đẹp.' }
      ],
      grammarPoints: [
        { pattern: '迎刃而解 (Thành ngữ: chẻ tre gặp đốt, vấn đề được giải quyết dễ dàng)', explanationVi: 'Thành ngữ HSK 6 rất hay dùng khi nêu giải pháp đúng trúng trọng tâm.', exampleHanzi: '找到根源后，难题便迎刃而解。', examplePinyin: 'Zhǎodào gēnyuán hòu, nántí biàn yíngrènérjiě.', exampleVi: 'Sau khi tìm ra gốc rễ, vấn đề khó liền được giải quyết dễ dàng.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '面对意见分歧时，第一步应该怎么做？', questionPinyin: 'Miànduì yìjiàn fēnqí shí, dì yī bù yīnggāi zěnme zuò?', questionVi: 'Khi đối mặt bất đồng ý kiến, bước đầu tiên nên làm gì?', sampleAnswerHanzi: '先真诚地倾听并复述对方的立场。', sampleAnswerPinyin: 'Xiān zhēnchéng de qīngtīng bìng fùshù duìfāng de lìchǎng.', sampleAnswerVi: 'Trước hết chân thành lắng nghe và nhắc lại lập trường của đối phương.' }
      ]
    }
  },
  {
    id: 'curated_hsk6_city',
    level: 6,
    category: 'Du lịch & Giao thông',
    title: '古韵与现代交融的城市风貌 (Vẻ đẹp giao hòa cổ kính & hiện đại của đô thị)',
    targetWords: ['交融', '风貌', '遗产', '保留', '繁华', '底蕴', '叹为观止'],
    content: {
      topic: 'Du lịch & Giao thông',
      summaryVi: 'Cảm nhận sự kết hợp hài hòa giữa kiến trúc cổ di sản và đô thị hiện đại khi du lịch sâu.',
      lines: [
        { speaker: '散文', hanzi: '漫步在苏州的老街小巷，白墙黛瓦倒映在潺潺流水中，仿佛一幅徐徐展开的水墨画卷。', pinyin: 'Mànbù zài Sūzhōu de lǎojiē xiǎoxiàng, báiqiáng dàiwǎ dàoyìng zài chánchán liúshuǐ zhōng, fǎngfú yī fú xúxú zhǎnkāi de shuǐmò huàjuàn.', translationVi: 'Dạo bước qua những con ngõ cổ Tô Châu, tường trắng ngói đen soi bóng xuống dòng nước róc rách như một bức tranh thủy mặc từ từ mở ra.' },
        { speaker: '散文', hanzi: '而仅几公里之外，高耸入云的现代化商务区灯火璀璨，展现出蓬勃向上的都市活力。', pinyin: 'Ér jǐn jǐ gōnglǐ zhīwài, gāosǒng rùyún de xiàndàihuà shāngwùqū dēnghuǒ cuǐcàn, zhǎnxiànchū péngbó xiàngshàng de dūshì huólì.', translationVi: 'Thế mà chỉ cách vài cây số, khu thương mại hiện đại với những tòa nhà chọc trời rực rỡ ánh đèn phô diễn sức sống đô thị tràn đầy.' },
        { speaker: '散文', hanzi: '一座城市最动人的魅力，莫过于在拥抱现代繁华的同时，依然悉心守护着千年的文化底蕴。', pinyin: 'Yī zuò chéngshì zuì dòngrén de mèilì, mòguòyú zài yōngbào xiàndài fánhuá de tóngshí, yīrán xīxīn shǒuhùzhe qiānnián de wénhuà dǐyùn.', translationVi: 'Sức hút lay động lòng người nhất của một đô thị không gì hơn là vừa đón nhận phồn hoa hiện đại, vừa nâng niu gìn giữ chiều sâu văn hóa ngàn năm.' }
      ],
      grammarPoints: [
        { pattern: '莫过于…… (Không gì hơn là...)', explanationVi: 'Cấu trúc cao cấp HSK 6 để nhấn mạnh điều tốt đẹp/nổi bật nhất.', exampleHanzi: '最幸福的事莫过于家人平安。', examplePinyin: 'Zuì xìngfú de shì mòguòyú jiārén píngān.', exampleVi: 'Điều hạnh phúc nhất không gì hơn là gia đình bình an.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '作者认为一座城市最动人的魅力是什么？', questionPinyin: 'Zuòzhě rènwéi yī zuò chéngshì zuì dòngrén de mèilì shì shénme?', questionVi: 'Tác giả cho rằng sức hút lay động nhất của một thành phố là gì?', sampleAnswerHanzi: '拥抱现代繁华的同时守护千年文化底蕴。', sampleAnswerPinyin: 'Yōngbào xiàndài fánhuá de tóngshí shǒuhù qiānnián wénhuà dǐyùn.', sampleAnswerVi: 'Vừa đón nhận sự phồn hoa hiện đại vừa bảo vệ chiều sâu văn hóa ngàn năm.' }
      ]
    }
  },
  {
    id: 'curated_hsk6_health',
    level: 6,
    category: 'Sức khỏe & Đời sống',
    title: '顺应节气的东方养生观 (Triết lý dưỡng sinh thuận theo tiết khí phương Đông)',
    targetWords: ['节气', '养生', '顺应', '规律', '均衡', '预防', '和谐'],
    content: {
      topic: 'Sức khỏe & Đời sống',
      summaryVi: 'Tìm hiểu tinh thần "chữa bệnh trước khi phát bệnh" và sống thuận tự nhiên trong văn hóa Á Đông.',
      lines: [
        { speaker: '学者', hanzi: '中国传统的二十四节气不仅是农耕文明的智慧结晶，更深刻地影响着人们的日常饮食与起居。', pinyin: 'Zhōngguó chuántǒng de èrshísì jiéqì bùjǐn shì nónggēng wénmíng de zhìhuì jiéjīng, gèng shēnkè de yǐngxiǎngzhe rénmen de rìcháng yǐnshí yǔ qǐjū.', translationVi: '24 tiết khí truyền thống của Trung Quốc không chỉ là kết tinh trí tuệ nền văn minh nông nghiệp mà còn ảnh hưởng sâu sắc tới ăn uống, sinh hoạt hàng ngày.' },
        { speaker: '学者', hanzi: '东方养生讲究“治未病”，提倡顺应四季寒暑变化，在疾病发生之前便通过饮食均衡与适度运动加以预防。', pinyin: 'Dōngfāng yǎngshēng jiǎngjiu "zhì wèi bìng", tíchàng shùnyìng sìjì hánshǔ biànhuà, zài jíbìng fāshēng zhīqián biàn tōngguò yǐnshí jūnhéng yǔ shìdù yùndòng jiāyǐ yùfáng.', translationVi: 'Dưỡng sinh phương Đông đề cao "trị bệnh khi chưa phát", khuyến khích thuận theo biến đổi nóng lạnh bốn mùa, chủ động phòng bệnh từ sớm qua dinh dưỡng cân bằng và vận động điều độ.' },
        { speaker: '学者', hanzi: '归根结底，健康并非依赖昂贵的补品，而是源于日复一日自律且和谐的生活节奏。', pinyin: 'Guīgēnjiédǐ, jiànkāng bìngfēi yīlài ángguì de bǔpǐn, érshì yuányú rìfùyīrì zìlǜ qiě héxié de shēnghuó jiézòu.', translationVi: 'Suy cho cùng, sức khỏe không lệ thuộc vào thuốc bổ đắt tiền mà bắt nguồn từ nhịp sống kỷ luật và hài hòa ngày này qua ngày khác.' }
      ],
      grammarPoints: [
        { pattern: '并非 A，而是 B (Tuyệt không phải A, mà chính là B)', explanationVi: 'Cấu trúc phủ định – khẳng định sắc bén trong văn nghị luận HSK 6.', exampleHanzi: '成功并非偶然，而是努力的结果。', examplePinyin: 'Chénggōng bìngfēi ǒurán, érshì nǔlì de jiéguǒ.', exampleVi: 'Thành công không hề ngẫu nhiên mà là kết quả của nỗ lực.' }
      ],
      questions: [
        { id: 'q1', questionHanzi: '“治未病”在文中指的是什么意思？', questionPinyin: '"Zhì wèi bìng" zài wénzhōng zhǐ de shì shénme yìsi?', questionVi: '"Trị vị bệnh" trong bài có ý nghĩa gì?', sampleAnswerHanzi: '在疾病发生之前通过均衡饮食和适度运动加以预防。', sampleAnswerPinyin: 'Zài jíbìng fāshēng zhīqián tōngguò jūnhéng yǐnshí hé shìdù yùndòng jiāyǐ yùfáng.', sampleAnswerVi: 'Chủ động phòng ngừa trước khi bệnh phát sinh bằng ăn uống cân bằng và vận động điều độ.' }
      ]
    }
  }
];
