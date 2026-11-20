import type { UsageDetails } from '@/types';

/**
 * Chi tiết đa trường hợp sử dụng (4 tầng + sắc thái + cấu trúc ngữ pháp + collocations + phân biệt chữ dễ nhầm)
 * cho các từ cốt lõi hay thi và hay dùng nhầm nhất trong HSK 1–3.
 */
export const RICH_USAGE_OVERRIDES: Record<string, UsageDetails> = {
  的: {
    senses: [
      {
        partOfSpeech: 'Trợ từ kết cấu',
        register: 'trung tính',
        meaningVi: 'Của (nối định ngữ sở hữu hoặc miêu tả với danh từ trung tâm)',
        grammarPattern: 'Định ngữ (Người/Tính từ/Cụm) + 的 + Danh từ',
        collocations: ['我的书', '漂亮的花', '刚买的手机'],
        examples: [
          {
            hanzi: '这是我的汉语老师。',
            pinyin: 'Zhè shì wǒ de Hànyǔ lǎoshī.',
            literalVi: 'Đây là tôi của Hán-ngữ giáo-viên.',
            translationVi: 'Đây là giáo viên tiếng Trung của tôi.'
          },
          {
            hanzi: '我喜欢喝冰凉的越南咖啡。',
            pinyin: 'Wǒ xǐhuan hē bīngliáng de Yuènán kāfēi.',
            literalVi: 'Tôi thích uống mát-lạnh của Việt-Nam cà-phê.',
            translationVi: 'Tôi thích uống cà phê đá Việt Nam.'
          }
        ]
      },
      {
        partOfSpeech: 'Trợ từ ngữ khí (cấu trúc 是...的)',
        register: 'khẩu ngữ',
        meaningVi: 'Nhấn mạnh thời gian, địa điểm hoặc cách thức của hành động đã xảy ra',
        grammarPattern: 'Chủ ngữ + 是 + [Thời gian / Địa điểm / Cách thức] + Động từ + 的',
        collocations: ['什么时候来的', '坐飞机来的', '在网上买的'],
        examples: [
          {
            hanzi: '我是昨天坐飞机来北京的。',
            pinyin: 'Wǒ shì zuótiān zuò fēijī lái Běijīng de.',
            literalVi: 'Tôi là hôm-qua ngồi máy-bay đến Bắc-Kinh (nhấn mạnh).',
            translationVi: 'Tôi đi máy bay đến Bắc Kinh vào hôm qua.'
          }
        ]
      },
      {
        partOfSpeech: 'Đại từ hóa (Cụm chữ 的)',
        register: 'khẩu ngữ',
        meaningVi: 'Thay thế cho danh từ đã rõ ngữ cảnh ("cái màu đỏ", "người bán hàng")',
        grammarPattern: 'Tính từ / Động từ + 的',
        collocations: ['红色的', '吃的', '卖水果的'],
        examples: [
          {
            hanzi: '这件太小了，请给我换一件大一点的。',
            pinyin: 'Zhè jiàn tài xiǎo le, qǐng gěi wǒ huàn yī jiàn dà yīdiǎn de.',
            literalVi: 'Chiếc này quá nhỏ rồi, xin đổi tôi chiếc to chút cái.',
            translationVi: 'Chiếc này chật quá, cho tôi đổi sang chiếc rộng hơn chút nhé.'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '地',
        pinyin: 'de',
        differenceVi: '的 đứng trước DANH TỪ; 地 đứng trước ĐỘNG TỪ để bổ nghĩa cách thức.',
        exampleContrast: '认真[的]学生 (học sinh chăm chỉ) vs 认真[地]学习 (học một cách chăm chỉ)'
      },
      {
        word: '得',
        pinyin: 'de',
        differenceVi: '得 đứng SAU động từ hoặc tính từ để dẫn ra bổ ngữ đánh giá mức độ.',
        exampleContrast: '她说汉语说[得]很流利 (Cô ấy nói tiếng Trung rất lưu loát)'
      }
    ],
    mnemonicStoryVi:
      'Gồm 白 (màu trắng) + 勺 (cái thìa): Chiếc thìa trắng tinh thuộc về riêng ai đó → chữ 的 (của).'
  },

  了: {
    senses: [
      {
        partOfSpeech: 'Trợ từ động thái (đặt ngay sau động từ)',
        register: 'trung tính',
        meaningVi: 'Biểu thị hành động ĐÃ hoàn thành (đặt giữa động từ và tân ngữ có định ngữ)',
        grammarPattern: 'Chủ ngữ + Động từ + 了 + [Số lượng/Định ngữ] + Tân ngữ',
        collocations: ['买了一本书', '吃了两碗饭', '学了三年'],
        examples: [
          {
            hanzi: '我昨天在书店买了两本词典。',
            pinyin: 'Wǒ zuótiān zài shūdiàn mǎile liǎng běn cídiǎn.',
            literalVi: 'Tôi hôm-qua ở hiệu-sách mua-rồi hai quyển từ-điển.',
            translationVi: 'Hôm qua tôi đã mua hai cuốn từ điển ở hiệu sách.'
          }
        ]
      },
      {
        partOfSpeech: 'Trợ từ ngữ khí (đặt cuối câu)',
        register: 'khẩu ngữ',
        meaningVi: 'Biểu thị sự thay đổi trạng thái mới xuất hiện ("trời mưa rồi", "đói rồi")',
        grammarPattern: 'Chủ ngữ + Vị ngữ + 了',
        collocations: ['下雨了', '天黑了', '我懂了', '不去了'],
        examples: [
          {
            hanzi: '外面下雨了，快把衣服收进来吧。',
            pinyin: 'Wàimiàn xiàyǔ le, kuài bǎ yīfu shōu jìnlái ba.',
            literalVi: 'Ngoài-trời mưa rồi, mau đem quần-áo cất vào đi.',
            translationVi: 'Ngoài trời đổ mưa rồi, mau cất quần áo vào đi.'
          }
        ]
      },
      {
        partOfSpeech: 'Cấu trúc cảm thán / sắp xảy ra',
        register: 'khẩu ngữ',
        meaningVi: 'Đi kèm 太...了 (quá... rồi) hoặc 快要...了 (sắp... rồi)',
        grammarPattern: '太 + Tính từ + 了  |  快(要) + Động từ + 了',
        collocations: ['太好了', '太贵了', '快要开始了'],
        examples: [
          {
            hanzi: '电影快要开始了，我们快进去吧！',
            pinyin: 'Diànyǐng kuàiyào kāishǐ le, wǒmen kuài jìnqù ba!',
            literalVi: 'Phim sắp bắt-đầu rồi, chúng-ta mau vào đi!',
            translationVi: 'Phim sắp chiếu rồi, chúng ta mau vào thôi!'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '过',
        pinyin: 'guo',
        differenceVi: '了 nhấn mạnh việc đã hoàn thành hoặc còn ảnh hưởng; 过 nhấn mạnh TỪNG có trải nghiệm trong quá khứ (nay đã chấm dứt).',
        exampleContrast: '他去[了]北京 (Anh ấy đi Bắc Kinh rồi, có thể vẫn ở đó) vs 他去[过]北京 (Anh ấy từng đi Bắc Kinh rồi, nay đã về)'
      }
    ]
  },

  就: {
    senses: [
      {
        partOfSpeech: 'Phó từ thời gian / số lượng',
        register: 'trung tính',
        meaningVi: 'Nhấn mạnh hành động xảy ra SỚM, NHANH, ít tốn công hơn mong đợi',
        grammarPattern: 'Thời gian / Điều kiện + 就 + Động từ',
        collocations: ['早就来了', '五分钟就到', '一学就会'],
        examples: [
          {
            hanzi: '我六点就起床了。',
            pinyin: 'Wǒ liù diǎn jiù qǐchuáng le.',
            literalVi: 'Tôi sáu giờ đã thức-dậy rồi.',
            translationVi: 'Mới sáu giờ tôi đã dậy rồi.'
          },
          {
            hanzi: '走过去只要五分钟就到。',
            pinyin: 'Zǒu guòqù zhǐyào wǔ fēnzhōng jiù dào.',
            literalVi: 'Đi bộ qua chỉ-cần năm phút liền tới.',
            translationVi: 'Đi bộ sang chỉ mất 5 phút là tới ngay.'
          }
        ]
      },
      {
        partOfSpeech: 'Phó từ nhấn mạnh / nối vế',
        register: 'khẩu ngữ',
        meaningVi: 'Chính là, ngay tại; liền, thì (trong cấu trúc 如果...就..., 只要...就...)',
        grammarPattern: '就是 + Danh từ  |  如果/只要 A，就 B',
        collocations: ['就是这里', '马上就来', '只要...就...'],
        examples: [
          {
            hanzi: '银行就在超市旁边。',
            pinyin: 'Yínháng jiù zài chāoshì pángbiān.',
            literalVi: 'Ngân-hàng ngay ở siêu-thị bên-cạnh.',
            translationVi: 'Ngân hàng ở ngay sát bên siêu thị.'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '才',
        pinyin: 'cái',
        differenceVi: '就 biểu thị SỚM/NHANH/DỄ (cảm giác ít); 才 biểu thị MUỘN/CHẬM/KHÓ (cảm giác nhiều). Cuối câu dùng 就 thường có 了, dùng 才 thì KHÔNG dùng 了.',
        exampleContrast: '他八点[就]来了 (Mới 8h đã tới — sớm) vs 他十点[才]来 (Tận 10h mới tới — muộn)'
      }
    ]
  },

  才: {
    senses: [
      {
        partOfSpeech: 'Phó từ thời gian / mức độ',
        register: 'trung tính',
        meaningVi: 'Mới (nhấn mạnh xảy ra muộn, chậm, khó khăn hoặc số lượng ít)',
        grammarPattern: 'Thời gian / Số lượng + 才 + Động từ (không có 了 cuối câu)',
        collocations: ['十点才起', '刚才', '才二十岁'],
        examples: [
          {
            hanzi: '我等了半个小时，公交车才来。',
            pinyin: 'Wǒ děngle bàn gè xiǎoshí, gōngjiāochē cái lái.',
            literalVi: 'Tôi đợi nửa tiếng, xe-buýt mới đến.',
            translationVi: 'Tôi đợi suốt nửa tiếng đồng hồ xe buýt mới chịu tới.'
          }
        ]
      },
      {
        partOfSpeech: 'Phó từ điều kiện duy nhất',
        register: 'văn viết',
        meaningVi: 'Mới có thể (đi với 只有...才...)',
        grammarPattern: '只有 + Điều kiện duy nhất + 才 + Kết quả',
        collocations: ['只有...才...', '人才'],
        examples: [
          {
            hanzi: '只有每天坚持练习，才能说得流利。',
            pinyin: 'Zhǐyǒu měitiān jiānchí liànxí, cái néng shuō de liúlì.',
            literalVi: 'Chỉ-có mỗi-ngày kiên-trì luyện, mới có-thể nói lưu-loát.',
            translationVi: 'Chỉ có kiên trì luyện mỗi ngày thì mới nói trôi chảy được.'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '就',
        pinyin: 'jiù',
        differenceVi: '才 nhấn mạnh điều kiện bắt buộc / sự việc chậm trễ; 就 nhấn mạnh sự việc nhanh chóng / dễ dàng.',
        exampleContrast: '只要努力[就]能进步 vs 只有努力[才]能成功'
      }
    ]
  },

  比: {
    senses: [
      {
        partOfSpeech: 'Giới từ so sánh',
        register: 'trung tính',
        meaningVi: 'So với (dùng trong câu so sánh hơn; KHÔNG dùng 很 trước tính từ)',
        grammarPattern: 'A + 比 + B + Tính từ + (一点儿 / 得多 / Cụm số lượng)',
        collocations: ['比昨天热', '比我高五厘米', '比以前好多了'],
        examples: [
          {
            hanzi: '今天比昨天凉快多了。',
            pinyin: 'Jīntiān bǐ zuótiān liángkuai duō le.',
            literalVi: 'Hôm-nay so hôm-qua mát nhiều rồi.',
            translationVi: 'Hôm nay mát hơn hôm qua nhiều rồi.'
          },
          {
            hanzi: '他跑得比我快三秒。',
            pinyin: 'Tā pǎo de bǐ wǒ kuài sān miǎo.',
            literalVi: 'Anh-ấy chạy hơn tôi nhanh ba giây.',
            translationVi: 'Anh ấy chạy nhanh hơn tôi ba giây.'
          }
        ]
      },
      {
        partOfSpeech: 'Động từ',
        register: 'khẩu ngữ',
        meaningVi: 'So bì, thi đấu, ra hiệu bằng tay',
        grammarPattern: '跟 + B + 比 + [Mục so sánh]',
        collocations: ['比赛', '比较', '比分'],
        examples: [
          {
            hanzi: '别总跟别人比，跟昨天的自己比就好。',
            pinyin: 'Bié zǒng gēn biérén bǐ, gēn zuótiān de zìjǐ bǐ jiù hǎo.',
            literalVi: 'Đừng luôn cùng người-khác so, cùng hôm-qua bản-thân so là tốt.',
            translationVi: 'Đừng mãi so sánh với người khác, cứ so với chính mình ngày hôm qua là đủ.'
          }
        ]
      }
    ]
  },

  把: {
    senses: [
      {
        partOfSpeech: 'Giới từ (Câu chữ 把)',
        register: 'trung tính',
        meaningVi: 'Đem, lấy — đưa tân ngữ xác định lên trước động từ để nhấn mạnh sự tác động/thay đổi vị trí hoặc trạng thái',
        grammarPattern: 'Chủ ngữ + 把 + Tân ngữ xác định + Động từ + Thành phần khác (了/完/在/到/给...)',
        collocations: ['把门关上', '把书放在桌上', '把作业写完'],
        examples: [
          {
            hanzi: '请把这些生词抄在本子上。',
            pinyin: 'Qǐng bǎ zhèxiē shēngcí chāo zài běnzi shàng.',
            literalVi: 'Xin đem những từ-mới này chép ở vở trên.',
            translationVi: 'Xin hãy chép những từ mới này vào trong vở.'
          },
          {
            hanzi: '我把手机忘在家里了。',
            pinyin: 'Wǒ bǎ shǒujī wàng zài jiālǐ le.',
            literalVi: 'Tôi đem điện-thoại quên ở trong-nhà rồi.',
            translationVi: 'Tôi để quên điện thoại ở nhà mất rồi.'
          }
        ]
      },
      {
        partOfSpeech: 'Lượng từ',
        register: 'trung tính',
        meaningVi: 'Chiếc, cái (dùng cho vật có tay cầm: ghế, ô, chìa khóa, dao)',
        grammarPattern: 'Số từ + 把 + Danh từ',
        collocations: ['一把椅子', '一把伞', '一把钥匙'],
        examples: [
          {
            hanzi: '出门别忘了拿一把雨伞。',
            pinyin: 'Chūmén bié wàngle ná yī bǎ yǔsǎn.',
            literalVi: 'Ra-cửa đừng quên cầm một chiếc ô-mưa.',
            translationVi: 'Ra đường đừng quên mang theo một chiếc ô nhé.'
          }
        ]
      }
    ]
  },

  会: {
    senses: [
      {
        partOfSpeech: 'Động từ năng nguyện (Kỹ năng học được)',
        register: 'trung tính',
        meaningVi: 'Biết làm (nhờ học tập, rèn luyện mới làm được)',
        grammarPattern: 'Chủ ngữ + 会 / 不会 + Động từ',
        collocations: ['会说汉语', '会游泳', '会开车'],
        examples: [
          {
            hanzi: '我会说汉语，也会做越南春卷。',
            pinyin: 'Wǒ huì shuō Hànyǔ, yě huì zuò Yuènán chūnjuǎn.',
            literalVi: 'Tôi biết nói tiếng-Trung, cũng biết làm nem-rán Việt-Nam.',
            translationVi: 'Tôi biết nói tiếng Trung và cũng biết làm nem rán Việt Nam.'
          }
        ]
      },
      {
        partOfSpeech: 'Động từ năng nguyện (Phỏng đoán tương lai)',
        register: 'trung tính',
        meaningVi: 'Sẽ, chắc sẽ (dự đoán sự việc có khả năng xảy ra)',
        grammarPattern: 'Chủ ngữ + (一定/可能) + 会 + Vị ngữ + (的)',
        collocations: ['会下雨', '一定会成功', '不会迟到'],
        examples: [
          {
            hanzi: '明天下午可能会下雨。',
            pinyin: 'Míngtiān xiàwǔ kěnéng huì xiàyǔ.',
            literalVi: 'Ngày-mai chiều có-lẽ sẽ mưa.',
            translationVi: 'Chiều mai có khả năng sẽ mưa.'
          }
        ]
      },
      {
        partOfSpeech: 'Danh từ',
        register: 'trung tính',
        meaningVi: 'Cuộc họp, hội nghị, buổi gặp mặt',
        grammarPattern: '开会 / 参加...会',
        collocations: ['开会', '运动会', '音乐会'],
        examples: [
          {
            hanzi: '经理正在会议室开会呢。',
            pinyin: 'Jīnglǐ zhèngzài huìyìshì kāihuì ne.',
            literalVi: 'Giám-đốc đang phòng-họp mở-họp đấy.',
            translationVi: 'Giám đốc đang họp trong phòng họp.'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '能 / 可以',
        pinyin: 'néng / kěyǐ',
        differenceVi: '会 = kỹ năng đã học (biết bơi); 能 = năng lực đạt mức hoặc điều kiện khách quan cho phép (hôm nay khỏi ốm nên bơi được); 可以 = được cho phép (hồ bơi mở cửa nên được phép bơi).',
        exampleContrast: '我[会]开车 (Tôi biết lái xe) vs 今天喝酒了不[能]开车 (Hôm nay uống rượu không được lái xe)'
      }
    ]
  },

  在: {
    senses: [
      {
        partOfSpeech: 'Động từ tồn tại / Giới từ địa điểm',
        register: 'trung tính',
        meaningVi: 'Ở, tại (chỉ vị trí diễn ra hành động — cụm 在+Địa điểm ĐỨNG TRƯỚC động từ)',
        grammarPattern: 'Chủ ngữ + 在 + Địa điểm + Động từ',
        collocations: ['在家', '在图书馆看书', '在公司工作'],
        examples: [
          {
            hanzi: '我在咖啡馆里复习HSK生词。',
            pinyin: 'Wǒ zài kāfēiguǎn lǐ fùxí HSK shēngcí.',
            literalVi: 'Tôi ở quán-cà-phê trong ôn từ-mới HSK.',
            translationVi: 'Tôi đang ôn từ mới HSK trong quán cà phê.'
          }
        ]
      },
      {
        partOfSpeech: 'Phó từ tiếp diễn',
        register: 'khẩu ngữ',
        meaningVi: 'Đang làm gì (nhấn mạnh hành động đang diễn ra, hay đi kèm 呢 cuối câu)',
        grammarPattern: 'Chủ ngữ + (正)在 + Động từ + (呢)',
        collocations: ['在看书呢', '在听音乐', '正在做饭'],
        examples: [
          {
            hanzi: '别打扰他，他在认真写汉字呢。',
            pinyin: 'Bié dǎrǎo tā, tā zài rènzhēn xiě Hànzì ne.',
            literalVi: 'Đừng làm-phiền anh-ấy, anh-ấy đang chăm-chỉ viết chữ-Hán đấy.',
            translationVi: 'Đừng làm phiền anh ấy, anh ấy đang chăm chú viết chữ Hán đấy.'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '再',
        pinyin: 'zài',
        differenceVi: '在 chỉ vị trí/đang diễn ra; 再 mang nghĩa "lại, lần nữa" cho hành động ở tương lai.',
        exampleContrast: '他[在]家 (Anh ấy ở nhà) vs 请[再]说一遍 (Xin nói lại một lần nữa)'
      }
    ]
  },

  买: {
    senses: [
      {
        partOfSpeech: 'Động từ',
        register: 'trung tính',
        meaningVi: 'Mua, mua sắm',
        grammarPattern: 'Chủ ngữ + 买 + [Số lượng] + Hàng hóa',
        collocations: ['买东西', '买票', '买菜', '买单'],
        examples: [
          {
            hanzi: '我去超市买点新鲜水果。',
            pinyin: 'Wǒ qù chāoshì mǎi diǎn xīnxiān shuǐguǒ.',
            literalVi: 'Tôi đi siêu-thị mua chút tươi trái-cây.',
            translationVi: 'Tôi đi siêu thị mua ít hoa quả tươi.'
          },
          {
            hanzi: '服务员，买单！',
            pinyin: 'Fúwùyuán, mǎidān!',
            literalVi: 'Phục-vụ ơi, thanh-toán!',
            translationVi: 'Bạn ơi, tính tiền giúp mình nhé!'
          }
        ]
      }
    ],
    confusableComparisons: [
      {
        word: '卖',
        pinyin: 'mài',
        differenceVi: '买 (mǎi - thanh 3) là MUA (không có 十 trên đầu); 卖 (mài - thanh 4) là BÁN (có 十 trên đầu).',
        exampleContrast: '我[买]书 (Tôi mua sách) vs 书店[卖]书 (Hiệu sách bán sách)'
      }
    ],
    mnemonicStoryVi: 'Đi MUA (买) thì tay không đi vào nên đỉnh đầu trống trơn; còn BÁN (卖) phải có nhiều (十) hàng đội trên đầu mới bán được!'
  },

  想: {
    senses: [
      {
        partOfSpeech: 'Động từ năng nguyện',
        register: 'trung tính',
        meaningVi: 'Muốn, mong muốn (ý định nhẹ nhàng, lịch sự hơn 要)',
        grammarPattern: 'Chủ ngữ + 想 + Động từ',
        collocations: ['想去旅游', '想学汉语', '想喝茶'],
        examples: [
          {
            hanzi: '周末我想去书店买两本中文小说。',
            pinyin: 'Zhōumò wǒ xiǎng qù shūdiàn mǎi liǎng běn Zhōngwén xiǎoshuō.',
            literalVi: 'Cuối-tuần tôi muốn đi hiệu-sách mua hai quyển tiểu-thuyết tiếng-Trung.',
            translationVi: 'Cuối tuần tôi muốn ra hiệu sách mua hai cuốn tiểu thuyết tiếng Trung.'
          }
        ]
      },
      {
        partOfSpeech: 'Động từ (Suy nghĩ / Nhớ nhung)',
        register: 'khẩu ngữ',
        meaningVi: 'Suy nghĩ, nghĩ ngợi; nhớ nhung (người, quê hương)',
        grammarPattern: '想 + Người/Vật/Vấn đề',
        collocations: ['想家', '想办法', '想念', '想法'],
        examples: [
          {
            hanzi: '出来留学半年了，我非常想家。',
            pinyin: 'Chūlái liúxué bàn nián le, wǒ fēicháng xiǎngjiā.',
            literalVi: 'Ra-ngoài du-học nửa năm rồi, tôi vô-cùng nhớ-nhà.',
            translationVi: 'Đi du học được nửa năm rồi, tôi nhớ nhà vô cùng.'
          }
        ]
      }
    ],
    mnemonicStoryVi: '相 (nhìn ngắm dung mạo) đặt trên 心 (trái tim) → Hình bóng người ấy luôn hiện lên trong tim chính là NHỚ / NGHĨ (想).'
  }
};
