import { UIToSandboxMessage, sendToUI } from '../shared/messages';
import { PLUGIN_WIDTH, PLUGIN_HEIGHT, DEFAULT_TOKEN_PRICES, QUICK_ACTIONS } from '../shared/constants';
import { StorageManager } from './storage-manager';
import { ApiClient } from './api-client';
import { getSelectedTextNodes, applyTextToNodes, applyDataSubstitution, applyDataSubstitutionSequential, reverseRenameByContent, getPromptVariableContext, undoLastOperation, exportSelectionAsBase64 } from './figma-helpers';
import { withRetry } from './retry-helper';
import { generateUniqueId, resolvePromptVariables, promptHasVariables } from '../shared/utils';
import { SimpleAbortSignal, createTimeoutSignal } from '../shared/abort-helper';
import type { DataPreset } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
// V2 Feature Handlers
import { RenameHandler } from './rename-handler';
import { PromptsHandler } from './prompts-handler';
import { BatchProcessor } from './batch-processor';
import { ProviderFactory } from './providers/ProviderFactory';
import { PROVIDER_CONFIGS } from '../shared/providers';
import { findModelById, modelToUserConfig } from '../shared/provider-groups-utils';
import { ResponseCache } from './response-cache';

// Стандартные пресеты для быстрого доступа
const BUILT_IN_PRESETS: Record<string, DataPreset> = {
  user: {
    id: 'built-in-user',
    name: 'User',
    version: 1,
    fieldNames: ['name', 'email', 'phone', 'address', 'role', 'balance', 'initials'],
    defaultValues: {
      name: 'Alex Johnson',
      email: 'alex.johnson@email.com',
      phone: '+7 (999) 123-45-67',
      address: 'ул. Ленина, д. 12, кв. 34',
      role: 'Покупатель',
      balance: '4 250 ₽',
      initials: 'AJ',
    },
    groups: [
      { id: 'user-1',  name: 'Alex Johnson',   values: { name: 'Alex Johnson',   email: 'alex.johnson@email.com',    phone: '+7 (999) 123-45-67', address: 'ул. Ленина, д. 12, кв. 34',       role: 'Покупатель',   balance: '4 250 ₽',    initials: 'AJ' } },
      { id: 'user-2',  name: 'Мария Иванова',  values: { name: 'Мария Иванова',  email: 'maria.ivanova@mail.ru',     phone: '+7 (916) 234-56-78', address: 'пр. Мира, д. 5, кв. 18',          role: 'Менеджер',     balance: '12 800 ₽',   initials: 'МИ' } },
      { id: 'user-3',  name: 'Сергей Петров',  values: { name: 'Сергей Петров',  email: 's.petrov@company.ru',       phone: '+7 (495) 345-67-89', address: 'ул. Садовая, д. 27, кв. 101',     role: 'Администратор',balance: '89 000 ₽',   initials: 'СП' } },
      { id: 'user-4',  name: 'Анна Смирнова',  values: { name: 'Анна Смирнова',  email: 'anna.smirnova@gmail.com',   phone: '+7 (812) 456-78-90', address: 'наб. Фонтанки, д. 3, кв. 7',      role: 'Покупатель',   balance: '1 630 ₽',    initials: 'АС' } },
      { id: 'user-5',  name: 'Дмитрий Козлов', values: { name: 'Дмитрий Козлов', email: 'd.kozlov@yandex.ru',        phone: '+7 (903) 567-89-01', address: 'ул. Пушкина, д. 44, кв. 22',      role: 'Курьер',       balance: '320 ₽',      initials: 'ДК' } },
      { id: 'user-6',  name: 'Елена Новикова', values: { name: 'Елена Новикова', email: 'e.novikova@work.com',        phone: '+7 (926) 678-90-12', address: 'бул. Пролетарский, д. 8, кв. 56', role: 'Менеджер',     balance: '7 450 ₽',    initials: 'ЕН' } },
      { id: 'user-7',  name: 'Игорь Волков',   values: { name: 'Игорь Волков',   email: 'igor.volkov@inbox.ru',       phone: '+7 (911) 789-01-23', address: 'ул. Гагарина, д. 19, кв. 3',      role: 'Покупатель',   balance: '23 100 ₽',   initials: 'ИВ' } },
      { id: 'user-8',  name: 'Ольга Морозова', values: { name: 'Ольга Морозова', email: 'o.morozova@example.com',     phone: '+7 (985) 890-12-34', address: 'пр. Победы, д. 66, кв. 14',       role: 'Покупатель',   balance: '560 ₽',      initials: 'ОМ' } },
      { id: 'user-9',  name: 'Николай Федоров',values: { name: 'Николай Федоров',email: 'n.fedorov@techcorp.ru',      phone: '+7 (977) 901-23-45', address: 'ул. Советская, д. 2, кв. 89',     role: 'Администратор',balance: '156 000 ₽',  initials: 'НФ' } },
      { id: 'user-10', name: 'Юлия Попова',    values: { name: 'Юлия Попова',    email: 'yu.popova@shop.com',         phone: '+7 (962) 012-34-56', address: 'ул. Цветочная, д. 33, кв. 71',    role: 'Покупатель',   balance: '3 980 ₽',    initials: 'ЮП' } },
      { id: 'user-11', name: 'Артём Лебедев',  values: { name: 'Артём Лебедев',  email: 'artem.lebedev@fastmail.com', phone: '+7 (909) 123-45-67', address: 'пер. Тихий, д. 11, кв. 5',        role: 'Курьер',       balance: '720 ₽',      initials: 'АЛ' } },
      { id: 'user-12', name: 'Татьяна Соколова',values:{ name: 'Татьяна Соколова',email:'t.sokolova@mailbox.org',    phone: '+7 (965) 234-56-78', address: 'ул. Комсомольская, д. 78, кв. 42', role: 'Менеджер',     balance: '9 100 ₽',    initials: 'ТС' } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  product: {
    id: 'built-in-product',
    name: 'Product',
    version: 1,
    fieldNames: ['name', 'price', 'category', 'description', 'rating'],
    defaultValues: {
      name: 'Органический мёд',
      price: '490 ₽',
      category: 'Сладкое и мёд',
      description: 'Натуральный цветочный мёд из экологически чистых районов',
      rating: '4.7',
    },
    groups: [
      { id: 'product-1',  name: 'Органический мёд',         values: { name: 'Органический мёд',         price: '490 ₽',   category: 'Сладкое и мёд',     description: 'Натуральный цветочный мёд из экологически чистых районов',     rating: '4.7' } },
      { id: 'product-2',  name: 'Авокадо спелое',           values: { name: 'Авокадо спелое',           price: '129 ₽',   category: 'Овощи и фрукты',    description: 'Спелые авокадо из Мексики, богатые полезными жирами',         rating: '4.5' } },
      { id: 'product-3',  name: 'Молоко 3,2%',              values: { name: 'Молоко 3,2%',              price: '89 ₽',    category: 'Молочные продукты', description: 'Пастеризованное коровье молоко от фермерского хозяйства',     rating: '4.8' } },
      { id: 'product-4',  name: 'Лосось охлаждённый',       values: { name: 'Лосось охлаждённый',       price: '1 290 ₽', category: 'Рыба и морепродукты',description: 'Свежий атлантический лосось, стейк 400 г',                   rating: '4.9' } },
      { id: 'product-5',  name: 'Хлеб «Бородинский»',       values: { name: 'Хлеб «Бородинский»',       price: '65 ₽',    category: 'Хлеб и выпечка',   description: 'Ржано-пшеничный хлеб с кориандром по классическому рецепту', rating: '4.6' } },
      { id: 'product-6',  name: 'Куриная грудка',           values: { name: 'Куриная грудка',           price: '349 ₽',   category: 'Мясо и птица',      description: 'Охлаждённое филе куриной грудки, 800 г, без антибиотиков',   rating: '4.7' } },
      { id: 'product-7',  name: 'Греческий йогурт',         values: { name: 'Греческий йогурт',         price: '115 ₽',   category: 'Молочные продукты', description: 'Натуральный йогурт 5% жирности без добавок, 350 г',          rating: '4.8' } },
      { id: 'product-8',  name: 'Паста Penne Rigate',       values: { name: 'Паста Penne Rigate',       price: '99 ₽',    category: 'Крупы и макароны',  description: 'Итальянская паста из твёрдых сортов пшеницы, 500 г',         rating: '4.5' } },
      { id: 'product-9',  name: 'Оливковое масло Extra Virgin',values:{name: 'Оливковое масло Extra Virgin',price:'599 ₽', category: 'Масло и соусы',     description: 'Нерафинированное масло первого холодного отжима, 500 мл',    rating: '4.9' } },
      { id: 'product-10', name: 'Яйца С1 десяток',          values: { name: 'Яйца С1 десяток',          price: '119 ₽',   category: 'Яйца',              description: 'Свежие куриные яйца первой категории от отечественных птицефабрик', rating: '4.6' } },
      { id: 'product-11', name: 'Кофе Арабика молотый',     values: { name: 'Кофе Арабика молотый',     price: '420 ₽',   category: 'Чай и кофе',        description: 'Молотый кофе 100% арабика средней обжарки, 250 г',           rating: '4.8' } },
      { id: 'product-12', name: 'Тёмный шоколад 85%',       values: { name: 'Тёмный шоколад 85%',       price: '189 ₽',   category: 'Сладкое и мёд',     description: 'Горький шоколад с высоким содержанием какао, 100 г',          rating: '4.7' } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  place: {
    id: 'built-in-place',
    name: 'Place',
    version: 1,
    fieldNames: ['name', 'index', 'address', 'city', 'country'],
    defaultValues: {
      name: 'Супермаркет «Фреш»',
      index: '101000',
      address: 'ул. Тверская, 18',
      city: 'Москва',
      country: 'Россия',
    },
    groups: [
      { id: 'place-1',  name: 'Тверская (Москва)',         values: { name: 'Супермаркет «Фреш»',       index: '101000', address: 'ул. Тверская, 18',              city: 'Москва',          country: 'Россия'  } },
      { id: 'place-2',  name: 'Невский (СПб)',             values: { name: 'Гипермаркет «Маркет»',     index: '191023', address: 'Невский пр., 44',               city: 'Санкт-Петербург', country: 'Россия'  } },
      { id: 'place-3',  name: 'Пр. Ленина (Новосибирск)', values: { name: 'Магазин «Продукты»',        index: '630004', address: 'пр. Ленина, 7',                 city: 'Новосибирск',     country: 'Россия'  } },
      { id: 'place-4',  name: 'Баумана (Казань)',          values: { name: 'Супермаркет «Kazan Fresh»', index: '420111', address: 'ул. Баумана, 31',               city: 'Казань',          country: 'Россия'  } },
      { id: 'place-5',  name: 'Монастырская (Пермь)',      values: { name: 'Магазин «Пермский»',        index: '614000', address: 'ул. Монастырская, 12',          city: 'Пермь',           country: 'Россия'  } },
      { id: 'place-6',  name: 'Кирова (Екатеринбург)',     values: { name: 'Гипермаркет «Урал»',        index: '620014', address: 'ул. Кирова, 24а',               city: 'Екатеринбург',    country: 'Россия'  } },
      { id: 'place-7',  name: 'Пушкинская (Ростов)',       values: { name: 'Маркет «Южный»',            index: '344006', address: 'ул. Пушкинская, 55',            city: 'Ростов-на-Дону',  country: 'Россия'  } },
      { id: 'place-8',  name: 'Чкалова (Нижний Новгород)',values: { name: 'Магазин «Волга»',            index: '603000', address: 'ул. Чкалова, 9',                city: 'Нижний Новгород', country: 'Россия'  } },
      { id: 'place-9',  name: 'Ленина (Омск)',             values: { name: 'Супермаркет «Сибирь»',      index: '644099', address: 'пр. Ленина, 2',                 city: 'Омск',            country: 'Россия'  } },
      { id: 'place-10', name: 'Красный пр. (Новосибирск)', values: { name: 'Магазин «Центральный»',    index: '630005', address: 'Красный пр., 17',               city: 'Новосибирск',     country: 'Россия'  } },
      { id: 'place-11', name: 'Мира (Красноярск)',         values: { name: 'Маркет «Енисей»',           index: '660049', address: 'пр. Мира, 96',                  city: 'Красноярск',      country: 'Россия'  } },
      { id: 'place-12', name: 'Победы (Воронеж)',          values: { name: 'Гипермаркет «Черноземье»',  index: '394000', address: 'ул. Победы, 1',                 city: 'Воронеж',         country: 'Россия'  } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  other: {
    id: 'built-in-other',
    name: 'Other',
    version: 1,
    fieldNames: ['title', 'description', 'username', 'date'],
    defaultValues: {
      title: 'Отличный магазин!',
      description: 'Заказываю здесь уже несколько лет. Всё всегда свежее, доставка быстрая.',
      username: 'Алексей В.',
      date: '15 января 2025',
    },
    groups: [
      { id: 'other-1',  name: 'Алексей В.',       values: { title: 'Отличный магазин!',           description: 'Заказываю здесь уже несколько лет. Всё всегда свежее, доставка быстрая.',                  username: 'Алексей В.',     date: '15 января 2025'   } },
      { id: 'other-2',  name: 'Мария К.',          values: { title: 'Свежие продукты каждый раз',  description: 'Приятно удивлена качеством. Овощи как будто только с грядки. Буду заказывать ещё!',         username: 'Мария К.',       date: '3 февраля 2025'   } },
      { id: 'other-3',  name: 'Дмитрий Р.',        values: { title: 'Быстрая доставка',            description: 'Привезли за час в час пик. Курьер был вежливым. Упаковка аккуратная, ничего не помялось.',  username: 'Дмитрий Р.',     date: '20 февраля 2025'  } },
      { id: 'other-4',  name: 'Светлана П.',       values: { title: 'Широкий выбор',               description: 'Нашла здесь даже редкие специи, которых нет в ближайших супермаркетах. Очень удобно!',     username: 'Светлана П.',    date: '7 марта 2025'     } },
      { id: 'other-5',  name: 'Игорь Т.',          values: { title: 'Цены порадовали',             description: 'Ожидал дороже, но оказалось дешевле чем в обычном магазине. Акции очень выгодные.',         username: 'Игорь Т.',       date: '14 марта 2025'    } },
      { id: 'other-6',  name: 'Анна Ф.',           values: { title: 'Рекомендую всем',             description: 'Посоветовала подругам и все в восторге. Пользуемся каждую неделю, нареканий нет никаких.',  username: 'Анна Ф.',        date: '1 апреля 2025'    } },
      { id: 'other-7',  name: 'Олег С.',           values: { title: 'Удобное приложение',          description: 'Сделать заказ — дело пяти минут. Интерфейс интуитивный, оплата без проблем.',               username: 'Олег С.',        date: '9 апреля 2025'    } },
      { id: 'other-8',  name: 'Наталья М.',        values: { title: 'Мясо высшего качества',       description: 'Брала охлаждённую говядину — нежнейшая. Дети съели с удовольствием. Спасибо!',              username: 'Наталья М.',     date: '22 апреля 2025'   } },
      { id: 'other-9',  name: 'Роман Д.',          values: { title: 'Стабильно хорошо',            description: 'Уже более 50 заказов — ни разу не разочаровал. Замены продуктов всегда согласовывают.',     username: 'Роман Д.',       date: '30 апреля 2025'   } },
      { id: 'other-10', name: 'Юлия Г.',           values: { title: 'Лучший онлайн-магазин!',      description: 'Перепробовала много сервисов, этот — лучший. Свежесть, цены и сервис на высоте.',            username: 'Юлия Г.',        date: '8 мая 2025'       } },
      { id: 'other-11', name: 'Андрей Л.',         values: { title: 'Уважаю за честность',         description: 'Однажды ошиблись с заказом — сразу вернули деньги и привезли компенсацию. Честный бизнес.', username: 'Андрей Л.',      date: '17 мая 2025'      } },
      { id: 'other-12', name: 'Виктория Н.',       values: { title: 'Экологичная упаковка',         description: 'Порадовала бумажная упаковка вместо пластика. Видно, что компания заботится об экологии.',  username: 'Виктория Н.',    date: '25 мая 2025'      } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  red: {
    id: 'built-in-red',
    name: 'Red',
    version: 1,
    fieldNames: ['code', 'title', 'description'],
    defaultValues: {
      code: 'ERR-001',
      title: 'Ошибка авторизации',
      description: 'Неверный логин или пароль. Проверьте данные и попробуйте снова.',
    },
    groups: [
      { id: 'red-1',  name: 'ERR-001 Авторизация',     values: { code: 'ERR-001', title: 'Ошибка авторизации',          description: 'Неверный логин или пароль. Проверьте данные и попробуйте снова.'                      } },
      { id: 'red-2',  name: 'ERR-002 Сеть',            values: { code: 'ERR-002', title: 'Ошибка подключения',           description: 'Не удаётся связаться с сервером. Проверьте интернет-соединение.'                     } },
      { id: 'red-3',  name: 'ERR-003 Оплата',          values: { code: 'ERR-003', title: 'Платёж отклонён',              description: 'Банк отклонил транзакцию. Свяжитесь с банком или используйте другую карту.'          } },
      { id: 'red-4',  name: 'ERR-404 Страница',        values: { code: 'ERR-404', title: 'Страница не найдена',          description: 'Запрашиваемая страница не существует или была удалена.'                               } },
      { id: 'red-5',  name: 'ERR-500 Сервер',          values: { code: 'ERR-500', title: 'Внутренняя ошибка сервера',    description: 'Что-то пошло не так на стороне сервера. Попробуйте позже.'                           } },
      { id: 'red-6',  name: 'ERR-006 Доступ',          values: { code: 'ERR-006', title: 'Нет доступа',                  description: 'У вас недостаточно прав для выполнения этого действия.'                              } },
      { id: 'red-7',  name: 'ERR-007 Сессия',          values: { code: 'ERR-007', title: 'Сессия истекла',               description: 'Время сессии вышло. Пожалуйста, войдите в аккаунт заново.'                          } },
      { id: 'red-8',  name: 'ERR-008 Файл',            values: { code: 'ERR-008', title: 'Ошибка загрузки файла',        description: 'Файл повреждён или имеет неподдерживаемый формат. Максимальный размер — 10 МБ.'       } },
      { id: 'red-9',  name: 'ERR-009 Поле',            values: { code: 'ERR-009', title: 'Ошибка валидации',             description: 'Поле заполнено некорректно. Проверьте формат введённых данных.'                       } },
      { id: 'red-10', name: 'ERR-010 Лимит',           values: { code: 'ERR-010', title: 'Превышен лимит запросов',      description: 'Слишком много запросов подряд. Подождите немного и попробуйте снова.'                 } },
      { id: 'red-11', name: 'ERR-011 Склад',           values: { code: 'ERR-011', title: 'Товар недоступен',             description: 'Выбранный товар закончился на складе. Попробуйте добавить его в список ожидания.'    } },
      { id: 'red-12', name: 'ERR-012 Адрес',           values: { code: 'ERR-012', title: 'Неверный адрес доставки',      description: 'Указанный адрес не найден. Проверьте данные или выберите адрес на карте.'             } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  blue: {
    id: 'built-in-blue',
    name: 'Blue',
    version: 1,
    fieldNames: ['title', 'description', 'icon'],
    defaultValues: {
      title: 'Обновление системы',
      description: 'Запланированное техническое обслуживание пройдёт сегодня с 02:00 до 04:00.',
      icon: 'ℹ️',
    },
    groups: [
      { id: 'blue-1',  name: 'Обновление системы',     values: { title: 'Обновление системы',        description: 'Запланированное техническое обслуживание пройдёт сегодня с 02:00 до 04:00.',      icon: 'ℹ️'  } },
      { id: 'blue-2',  name: 'Новые функции',          values: { title: 'Доступны новые функции',    description: 'Мы добавили быстрые фильтры и улучшили поиск. Попробуйте прямо сейчас!',          icon: '🆕'  } },
      { id: 'blue-3',  name: 'Синхронизация',          values: { title: 'Данные синхронизируются',   description: 'Ваш профиль обновляется. Это займёт не более 30 секунд.',                          icon: '🔄'  } },
      { id: 'blue-4',  name: 'Уведомление о сессии',   values: { title: 'Активная сессия',           description: 'Вы вошли в аккаунт с нового устройства: iPhone 15 Pro, Москва.',                   icon: '📱'  } },
      { id: 'blue-5',  name: 'Перебои в работе',       values: { title: 'Временные перебои',         description: 'Часть функций может работать медленнее. Мы уже занимаемся решением проблемы.',      icon: '⚙️'  } },
      { id: 'blue-6',  name: 'Напоминание',            values: { title: 'Напоминание',               description: 'В вашей корзине остались товары. Завершите оформление заказа.',                     icon: '🛒'  } },
      { id: 'blue-7',  name: 'Акция',                  values: { title: 'Скидки до 30%',             description: 'Акция действует только сегодня. Не упустите выгодные предложения на сезонные товары.',icon: '🏷️' } },
      { id: 'blue-8',  name: 'Совет',                  values: { title: 'Совет дня',                 description: 'Подпишитесь на push-уведомления, чтобы первым узнавать о скидках и акциях.',        icon: '💡'  } },
      { id: 'blue-9',  name: 'Режим работы',           values: { title: 'Изменение режима работы',   description: 'В праздничные дни доставка работает с 09:00 до 21:00. Принимайте заказы заранее.',   icon: '🗓️'  } },
      { id: 'blue-10', name: 'Конфиденциальность',     values: { title: 'Политика конфиденциальности',description: 'Мы обновили правила использования данных. Ознакомьтесь с новой версией.',           icon: '🔒'  } },
      { id: 'blue-11', name: 'Приложение',             values: { title: 'Новая версия приложения',   description: 'Доступна версия 4.2.0. Обновитесь для получения улучшенной производительности.',     icon: '📲'  } },
      { id: 'blue-12', name: 'Обратная связь',         values: { title: 'Оцените наш сервис',        description: 'Ваше мнение помогает нам стать лучше. Оставьте отзыв — это займёт 1 минуту.',        icon: '⭐'  } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  green: {
    id: 'built-in-green',
    name: 'Green',
    version: 1,
    fieldNames: ['title', 'description', 'icon'],
    defaultValues: {
      title: 'Заказ оформлен',
      description: 'Ваш заказ №48291 успешно принят. Ожидайте доставку сегодня с 14:00 до 18:00.',
      icon: '✅',
    },
    groups: [
      { id: 'green-1',  name: 'Заказ оформлен',        values: { title: 'Заказ оформлен',            description: 'Ваш заказ №48291 успешно принят. Ожидайте доставку сегодня с 14:00 до 18:00.',     icon: '✅'  } },
      { id: 'green-2',  name: 'Оплата прошла',         values: { title: 'Оплата прошла',             description: 'Списано 3 450 ₽ с карты •••• 4231. Чек отправлен на вашу почту.',                   icon: '💳'  } },
      { id: 'green-3',  name: 'Профиль обновлён',      values: { title: 'Профиль обновлён',           description: 'Ваши данные успешно сохранены. Изменения вступили в силу.',                         icon: '👤'  } },
      { id: 'green-4',  name: 'Товар добавлен',        values: { title: 'Товар добавлен в корзину',   description: 'Греческий йогурт добавлен в корзину. Итого 4 товара на 1 280 ₽.',                   icon: '🛒'  } },
      { id: 'green-5',  name: 'Подписка оформлена',    values: { title: 'Подписка оформлена',         description: 'Вы подписались на рассылку акций. Отписаться можно в настройках профиля.',           icon: '📧'  } },
      { id: 'green-6',  name: 'Адрес сохранён',        values: { title: 'Адрес доставки сохранён',   description: 'Адрес «ул. Ленина, 12, кв. 34» добавлен в список избранных адресов.',                icon: '📍'  } },
      { id: 'green-7',  name: 'Отзыв опубликован',     values: { title: 'Отзыв опубликован',          description: 'Ваш отзыв прошёл модерацию и опубликован. Спасибо за обратную связь!',              icon: '⭐'  } },
      { id: 'green-8',  name: 'Пароль изменён',        values: { title: 'Пароль успешно изменён',     description: 'Новый пароль установлен. Используйте его при следующем входе в систему.',            icon: '🔑'  } },
      { id: 'green-9',  name: 'Заказ доставлен',       values: { title: 'Заказ доставлен',            description: 'Заказ №48291 успешно доставлен. Приятного аппетита! Не забудьте оставить отзыв.',   icon: '🎉'  } },
      { id: 'green-10', name: 'Файл загружен',         values: { title: 'Файл успешно загружен',      description: 'Документ «квитанция.pdf» загружен и доступен в разделе «Мои файлы».',               icon: '📄'  } },
      { id: 'green-11', name: 'Промокод применён',     values: { title: 'Промокод применён',          description: 'Скидка 15% по промокоду FRESH15 успешно применена. Экономия: 520 ₽.',               icon: '🎟️'  } },
      { id: 'green-12', name: 'Уведомления включены',  values: { title: 'Уведомления включены',       description: 'Push-уведомления активированы. Вы будете первым узнавать о статусе заказа.',        icon: '🔔'  } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  yellow: {
    id: 'built-in-yellow',
    name: 'Yellow',
    version: 1,
    fieldNames: ['name', 'priority', 'date', 'status'],
    defaultValues: {
      name: 'Обновить каталог товаров',
      priority: 'Высокий',
      date: '15 июня 2025',
      status: 'В работе',
    },
    groups: [
      { id: 'yellow-1',  name: 'Обновить каталог',      values: { name: 'Обновить каталог товаров',          priority: 'Высокий',   date: '15 июня 2025',   status: 'В работе'    } },
      { id: 'yellow-2',  name: 'Разработать дизайн',    values: { name: 'Разработать дизайн главной страницы',priority: 'Высокий',   date: '20 июня 2025',   status: 'В очереди'   } },
      { id: 'yellow-3',  name: 'Настроить доставку',    values: { name: 'Настроить зоны доставки',            priority: 'Средний',   date: '22 июня 2025',   status: 'В работе'    } },
      { id: 'yellow-4',  name: 'Провести тестирование', values: { name: 'Провести нагрузочное тестирование',  priority: 'Высокий',   date: '25 июня 2025',   status: 'В очереди'   } },
      { id: 'yellow-5',  name: 'Написать документацию', values: { name: 'Написать документацию API',          priority: 'Низкий',    date: '30 июня 2025',   status: 'Не начата'   } },
      { id: 'yellow-6',  name: 'Интеграция оплаты',     values: { name: 'Интеграция платёжной системы',       priority: 'Высокий',   date: '18 июня 2025',   status: 'В работе'    } },
      { id: 'yellow-7',  name: 'Рефакторинг кода',      values: { name: 'Рефакторинг модуля корзины',         priority: 'Средний',   date: '5 июля 2025',    status: 'В очереди'   } },
      { id: 'yellow-8',  name: 'Отчёт по аналитике',    values: { name: 'Подготовить отчёт по аналитике',     priority: 'Средний',   date: '10 июля 2025',   status: 'Не начата'   } },
      { id: 'yellow-9',  name: 'Запустить рассылку',    values: { name: 'Запустить email-рассылку акций',      priority: 'Низкий',    date: '12 июля 2025',   status: 'В очереди'   } },
      { id: 'yellow-10', name: 'Обновить мобильное',    values: { name: 'Обновить мобильное приложение',       priority: 'Высокий',   date: '7 июля 2025',    status: 'В работе'    } },
      { id: 'yellow-11', name: 'Аудит безопасности',    values: { name: 'Аудит безопасности системы',          priority: 'Высокий',   date: '28 июня 2025',   status: 'В работе'    } },
      { id: 'yellow-12', name: 'Оптимизация БД',        values: { name: 'Оптимизация базы данных',             priority: 'Средний',   date: '15 июля 2025',   status: 'Не начата'   } },
    ],
    multiValueSeparator: ', ',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

/**
 * Главный класс плагина
 */
class PluginSandbox {
  private storageManager: StorageManager;
  private apiClient: ApiClient;
  private activeGenerations = new Map<string, SimpleAbortSignal>();
  private pendingTranslation: { textNode: TextNode; originalText: string } | null = null;
  private pendingQuickActionId: string | null = null;

  // V2 Feature Handlers
  private renameHandler: RenameHandler;
  private promptsHandler: PromptsHandler;
  private batchProcessor: BatchProcessor;
  private responseCache: ResponseCache;

  constructor() {
    this.storageManager = new StorageManager();
    this.apiClient = new ApiClient(this.storageManager);

    // Initialize V2 handlers
    this.renameHandler = new RenameHandler(this.storageManager, this.apiClient);
    this.promptsHandler = new PromptsHandler(this.storageManager);
    this.batchProcessor = new BatchProcessor();
    this.responseCache = new ResponseCache();

    this.setupMessageListener();
    this.initializePlugin();
  }

  /**
   * Инициализация плагина
   */
  private async initializePlugin(): Promise<void> {
    // Проверяем команду
    const command = figma.command;

    if (command === 'open-plugin') {
      // Открываем полный UI плагина
      figma.showUI(__html__, {
        width: PLUGIN_WIDTH,
        height: PLUGIN_HEIGHT,
        themeColors: true,
      });
    } else if (command === 'quick-apply') {
      // Показываем компактное окно для выбора пресета
      await this.showQuickApplyUI();
    } else if (command === 'reverse-rename') {
      // Показываем окно для выбора пресета для обратного переименования
      await this.showReverseRenameUI();
    } else if (command && QUICK_ACTIONS.some(qa => qa.id === command)) {
      // Быстрое действие генерации через LLM (без открытия UI)
      await this.showQuickActionUI(command);
    } else if (command && command.startsWith('builtin-')) {
      // Быстрое применение встроенного пресета
      const presetKey = command.replace('builtin-', '');
      const preset = BUILT_IN_PRESETS[presetKey];
      if (preset) {
        await this.quickApplyPreset(preset.id, preset);
      }
      figma.closePlugin();
    } else {
      // Дефолтное поведение - показываем полный UI
      figma.showUI(__html__, {
        width: PLUGIN_WIDTH,
        height: PLUGIN_HEIGHT,
        themeColors: true,
      });

      // Initialize V2 handlers AFTER UI is shown
      await this.renameHandler.initialize().catch(err => {
        console.error('Failed to initialize RenameHandler:', err);
      });
      await this.promptsHandler.initialize().catch(err => {
        console.error('Failed to initialize PromptsHandler:', err);
      });
    }

    console.log('Figma LLM Plugin initialized');
  }

  /**
   * Показать компактный UI для быстрого выбора пресета
   */
  private async showQuickApplyUI(): Promise<void> {
    const settings = await this.storageManager.loadDataPresets();

    if (settings.presets.length === 0) {
      figma.notify('No presets available. Create presets first.');
      figma.closePlugin();
      return;
    }

    // Создаём простой HTML для выбора
    let html = '<html><head><style>';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px; margin: 0; font-size: 12px; }';
    html += '.preset-item { padding: 8px 12px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: all 0.2s; }';
    html += '.preset-item:hover { background: #f0f0f0; border-color: #18a0fb; }';
    html += '.preset-name { font-weight: 600; margin-bottom: 2px; }';
    html += '.preset-info { font-size: 10px; color: #999; }';
    html += '</style></head><body>';
    html += '<h3 style="margin: 0 0 12px 0;">Select Preset to Apply</h3>';

    for (const preset of settings.presets) {
      html += '<div class="preset-item" onclick="parent.postMessage({ pluginMessage: { type: \'quick-apply-preset\', presetId: \'' + preset.id + '\' } }, \'*\')">';
      html += '<div class="preset-name">' + preset.name + '</div>';
      html += '<div class="preset-info">' + preset.groups.length + ' groups</div>';
      html += '</div>';
    }

    html += '</body></html>';

    figma.showUI(html, {
      width: 300,
      height: Math.min(400, 100 + settings.presets.length * 60),
      themeColors: true,
    });
  }

  /**
   * Настройка слушателя сообщений от UI
   */
  private setupMessageListener(): void {
    figma.ui.onmessage = async (message: UIToSandboxMessage) => {
      await this.handleUIMessage(message);
    };
  }

  /**
   * Обработка сообщений от UI
   */
  private async handleUIMessage(message: any): Promise<void> {
    try {
      // Специальная обработка ui-ready для фоновых операций
      if (message.type === 'ui-ready') {
        if (this.pendingQuickActionId) {
          await this.executeQuickAction();
        } else {
          await this.executeTranslation();
        }
        return;
      }

      switch (message.type) {
        case 'load-settings':
          await this.handleLoadSettings(message);
          break;
        case 'save-settings':
          await this.handleSaveSettings(message);
          break;
        case 'reset-settings':
          await this.handleResetSettings();
          break;
        case 'settings-updated':
          // Просто пересылаем сообщение в UI для обновления в реальном времени
          sendToUI({
            type: 'settings-updated',
            settings: message.settings,
          });
          break;
        case 'generate-text':
          await this.handleGenerateText(message);
          break;
        case 'apply-text':
          await this.handleApplyText(message);
          break;
        case 'cancel-generation':
          await this.handleCancelGeneration(message);
          break;
        case 'clear-response-cache':
          this.responseCache.clear();
          sendToUI({ type: 'notification', level: 'info', message: 'Response cache cleared' });
          break;
        case 'get-selected-text':
          await this.handleGetSelectedText(message);
          break;
        case 'test-connection':
          await this.handleTestConnection(message);
          break;
        case 'test-translation':
          await this.handleTestTranslation(message);
          break;
        case 'load-data-presets':
          await this.handleLoadDataPresets(message);
          break;
        case 'save-data-presets':
          await this.handleSaveDataPresets(message);
          break;
        case 'apply-data-substitution':
          await this.handleApplyDataSubstitution(message);
          break;
        case 'quick-apply-preset':
          await this.handleQuickApplyPreset(message);
          break;
        case 'reverse-rename':
          await this.handleReverseRename(message.presetId);
          break;

        // V2 Rename messages
        case 'load-rename-settings':
          await this.renameHandler.initialize();
          break;
        case 'rename-preview':
          await this.renameHandler.handlePreview(message.presetId);
          break;
        case 'rename-apply':
          await this.renameHandler.handleApply(message.preview, message.presetId);
          break;
        case 'ai-rename-preview':
          await this.renameHandler.handleAIPreview(message.prompt, message.providerId, message.includeHierarchy);
          break;
        case 'save-rename-preset':
          await this.renameHandler.handleSavePreset(message.preset);
          break;
        case 'delete-rename-preset':
          await this.renameHandler.handleDeletePreset(message.presetId);
          break;

        // V2 Prompts messages
        case 'load-prompts-library':
          await this.promptsHandler.initialize();
          break;
        case 'save-prompt':
          await this.promptsHandler.handleSavePrompt(message.prompt);
          break;
        case 'update-prompt-usage':
          await this.promptsHandler.handleUpdateUsage(message.promptId);
          break;
        case 'delete-prompt':
          await this.promptsHandler.handleDeletePrompt(message.promptId);
          break;

        // V2 Batch processing
        case 'generate-batch':
          await this.handleGenerateBatch(message);
          break;

        // V2 Multi-field generation
        case 'get-selected-layers':
          await this.handleGetSelectedLayers(message);
          break;
        case 'generate-multi':
          await this.handleGenerateMulti(message);
          break;
        case 'cancel-multi-generation':
          this.handleCancelMultiGeneration(message);
          break;
        case 'apply-multi-results':
          await this.handleApplyMultiResults(message);
          break;

        // Undo
        case 'undo-last-operation':
          await this.handleUndoLastOperation(message);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Unknown error',
      });
    }
  }

  /**
   * Обработка загрузки настроек
   */
  private async handleLoadSettings(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadSettings();

      sendToUI({
        type: 'settings-loaded',
        id: message.id,
        settings,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to load settings',
      });
    }
  }

  /**
   * Обработка сохранения настроек
   */
  private async handleSaveSettings(message: any): Promise<void> {
    try {
      console.log('[Sandbox] Received save-settings message');
      console.log('[Sandbox] Settings to save:', JSON.stringify(message.settings, null, 2));

      await this.storageManager.saveSettings(message.settings);

      console.log('[Sandbox] Settings saved successfully');

      sendToUI({
        type: 'settings-saved',
        id: message.id,
        success: true,
      });

      // Notify UI to refresh provider dropdown and other live elements
      sendToUI({
        type: 'settings-updated',
        settings: message.settings,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: 'Settings saved',
      });
    } catch (error) {
      console.error('[Sandbox] Failed to save settings:', error);
      sendToUI({
        type: 'settings-saved',
        id: message.id,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Reset settings to defaults
   */
  private async handleResetSettings(): Promise<void> {
    try {
      console.log('[Sandbox] Resetting settings to defaults');
      const defaults = { ...DEFAULT_SETTINGS };
      await this.storageManager.saveSettings(defaults);

      sendToUI({
        type: 'settings-loaded',
        settings: defaults,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: 'Settings reset to defaults',
      });
    } catch (error) {
      console.error('[Sandbox] Failed to reset settings:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to reset settings',
      });
    }
  }

  /**
   * Обработка генерации текста
   */
  private async handleGenerateText(message: any): Promise<void> {
    const generationId = generateUniqueId();
    const abortSignal = new SimpleAbortSignal();
    this.activeGenerations.set(generationId, abortSignal);

    try {
      // V2.1: Получаем провайдер (поддержка groups и legacy configs)
      const settings = await this.storageManager.loadSettings();
      let config: any = null;

      // Пробуем найти в provider groups (V2.1)
      if (settings.providerGroups && settings.providerGroups.length > 0) {
        const modelInfo = findModelById(settings, message.providerId);
        if (modelInfo) {
          // Конвертируем ModelConfig + ProviderGroup в UserProviderConfig для совместимости
          config = modelToUserConfig(modelInfo.group, modelInfo.model);
        }
      }

      // Fallback на legacy providerConfigs (V2.0)
      if (!config && settings.providerConfigs) {
        config = settings.providerConfigs.find(c => c.id === message.providerId);
      }

      if (!config || !config.enabled) {
        throw new Error(
          '⚙️ Provider not found or disabled.\n' +
          'Go to Settings → Provider Groups → create a group with at least one model enabled.\n' +
          'Then select the model in the Generate tab dropdown.'
        );
      }

      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      if (!baseConfig) {
        throw new Error(
          '⚙️ Provider model configuration not found.\n' +
          `Base config "${config.baseConfigId}" does not exist in PROVIDER_CONFIGS.\n` +
          'Try deleting this provider group and creating a new one.'
        );
      }

      const provider = ProviderFactory.createProvider(config, baseConfig);

      const selectedTextNodes = await getSelectedTextNodes();

      // Resolve prompt variables ({layer_name}, {page_name}, etc.)
      let userPrompt = message.prompt;
      let userSystemPrompt = message.systemPrompt;
      if (promptHasVariables(userPrompt) || (userSystemPrompt && promptHasVariables(userSystemPrompt))) {
        const varContext = getPromptVariableContext();
        userPrompt = resolvePromptVariables(userPrompt, varContext);
        if (userSystemPrompt) {
          userSystemPrompt = resolvePromptVariables(userSystemPrompt, varContext);
        }
      }

      // Системный промпт
      // Для per-layer режима: инструкция пользователя (напр. "Переведи на английский")
      // становится СИСТЕМНЫМ промптом, а текст каждого слоя — user message.
      // Это даёт модели чёткое разделение: "что делать" vs "с чем делать".
      const hasSelectedLayers = selectedTextNodes.length > 0;
      let systemPrompt: string;
      const cleanOutputSuffix = '\n\nIMPORTANT: Output ONLY the result. No explanations, labels, quotes, or extra text.';

      if (hasSelectedLayers) {
        // Per-layer режим: формируем system prompt из всех доступных инструкций
        if (userSystemPrompt && userPrompt) {
          // Есть и system prompt, и prompt — комбинируем оба
          systemPrompt = `${userSystemPrompt}\n\nUser instruction: ${userPrompt}${cleanOutputSuffix}`;
        } else if (userSystemPrompt) {
          // Только system prompt (из библиотеки промптов)
          systemPrompt = `${userSystemPrompt}${cleanOutputSuffix}`;
        } else {
          // Только prompt (пользователь ввёл в поле промпта)
          systemPrompt = `${userPrompt}${cleanOutputSuffix}`;
        }
      } else {
        // Без слоёв: стандартная схема
        systemPrompt = userSystemPrompt || 'You are a helpful assistant.';
      }

      // Уведомляем UI о начале генерации
      sendToUI({
        type: 'generation-started',
        id: message.id,
        generationId,
        selectionContextCount: selectedTextNodes.length,
      });

      const startTime = Date.now();
      let totalTokens = 0;
      let appliedCount = 0;
      let lastFullText = '';

      if (selectedTextNodes.length === 0) {
        // Нет выделенных слоёв — просто генерируем текст по промпту
        // Check if vision mode is requested
        let screenshotBase64: string | null = null;
        if (message.attachScreenshot && provider.supportsVision()) {
          screenshotBase64 = await exportSelectionAsBase64();
          if (screenshotBase64) {
            console.log(`[PluginSandbox] Vision mode: attached screenshot (${screenshotBase64.length} chars base64)`);
          }
        }

        // Check response cache (skip for vision requests — images make caching impractical)
        const cacheKey = !screenshotBase64 ? ResponseCache.generateKey({
          providerId: message.providerId,
          prompt: userPrompt,
          systemPrompt,
          temperature: message.settings.temperature,
          maxTokens: message.settings.maxTokens,
        }) : null;

        const cached = cacheKey ? this.responseCache.get(cacheKey) : null;

        if (cached) {
          console.log('[PluginSandbox] Cache HIT — returning cached response');
          lastFullText = cached.text;
          totalTokens = cached.tokens;
        } else {
          const result = await withRetry(async () => {
            if (screenshotBase64 && provider.supportsVision()) {
              return await provider.generateTextWithImage(userPrompt, screenshotBase64, {
                ...message.settings,
                systemPrompt,
              });
            }
            return await provider.generateText(userPrompt, {
              ...message.settings,
              systemPrompt,
            });
          });

          lastFullText = result.text;
          totalTokens = result.tokens.input + result.tokens.output;

          // Store in cache (only non-vision responses)
          if (cacheKey) {
            this.responseCache.set(cacheKey, lastFullText, totalTokens);
            console.log(`[PluginSandbox] Cache MISS — stored response (cache size: ${this.responseCache.size})`);
          }
        }

        // Отправляем результат как чанк для совместимости с UI
        sendToUI({
          type: 'generation-chunk',
          id: message.id,
          generationId,
          chunk: lastFullText,
          tokensGenerated: totalTokens,
        });
      } else {
        // Есть выделенные слои — обрабатываем КАЖДЫЙ ОТДЕЛЬНО
        console.log(`[PluginSandbox] Processing ${selectedTextNodes.length} layer(s) individually`);

        sendToUI({
          type: 'notification',
          level: 'info',
          message: `Processing ${selectedTextNodes.length} layer${selectedTextNodes.length !== 1 ? 's' : ''}...`,
        });

        // Few-shot: собираем успешные пары (вход → выход) для обучения модели формату
        const fewShotPairs: Array<{ role: 'user' | 'assistant'; text: string }> = [];

        for (let i = 0; i < selectedTextNodes.length; i++) {
          if (abortSignal.aborted) break;

          const node = selectedTextNodes[i];

          let layerResult = '';
          let layerTokens = 0;

          const layerResultObj = await withRetry(async () => {
            // Для per-layer: temperature 0 (детерминированный вывод)
            // и малый maxTokens чтобы модель не генерировала лишнее
            const layerSettings = {
              ...message.settings,
              systemPrompt,
              temperature: 0,
              maxTokens: Math.min(message.settings.maxTokens || 2000, 200),
            };

            // Промпт — ТОЛЬКО текст слоя. Инструкция уже в systemPrompt.
            return await provider.generateText(node.characters, layerSettings);
          });

          layerResult = layerResultObj.text;
          layerTokens = layerResultObj.tokens.input + layerResultObj.tokens.output;
          totalTokens += layerTokens;

          // Отправляем прогресс в UI
          sendToUI({
            type: 'generation-chunk',
            id: message.id,
            generationId,
            chunk: '',
            tokensGenerated: totalTokens,
          });

          // Постобработка: очистка ответа от мусора нейросети
          let cleanResult = this.cleanAIResponse(layerResult, node.characters);

          // Вставляем результат в ЭТОТ КОНКРЕТНЫЙ слой (с записью в undo history)
          const applied = await applyTextToNodes(cleanResult, [node.id], generationId);
          appliedCount += applied;

          console.log(`[PluginSandbox] Layer ${i + 1}/${selectedTextNodes.length} "${node.name}": "${node.characters}" → "${cleanResult}"`);

          // Добавляем успешную пару в few-shot (максимум 2 примера чтобы не раздувать запрос)
          if (fewShotPairs.length < 4) { // 4 = 2 пары по 2 messages
            fewShotPairs.push(
              { role: 'user', text: node.characters },
              { role: 'assistant', text: cleanResult },
            );
          }

          lastFullText = cleanResult;

          // Задержка между запросами чтобы не превысить rate limit
          if (i < selectedTextNodes.length - 1 && !abortSignal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      const duration = Date.now() - startTime;
      const cost = this.calculateCost(message.providerId, totalTokens);

      // Трекаем использование
      await this.storageManager.trackTokenUsage(message.providerId, totalTokens, cost);

      // Генерация завершена
      sendToUI({
        type: 'generation-complete',
        id: message.id,
        generationId,
        fullText: lastFullText,
        tokensUsed: totalTokens,
        cost,
        duration,
        appliedCount,
      });
    } catch (error) {
      console.error('Generation error:', error);
      sendToUI({
        type: 'generation-error',
        id: message.id,
        generationId,
        error: error.message || 'Generation failed',
        retryable: error.retryable || false,
      });
    } finally {
      this.activeGenerations.delete(generationId);
    }
  }

  /**
   * Очистка ответа AI от мусора.
   * Работает корректно и для однострочных, и для многострочных текстов.
   *
   * Стратегия: сравниваем длину ответа с длиной оригинала.
   * Если ответ значительно длиннее (>3x) — значит модель нагенерировала мусор,
   * и нужно попробовать извлечь полезную часть.
   */
  private cleanAIResponse(rawResponse: string, originalText: string): string {
    let result = rawResponse.trim();

    // 1. Убираем обрамляющие кавычки
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith('«') && result.endsWith('»'))) {
      result = result.slice(1, -1).trim();
    }

    // 2. Убираем типичные префиксы от нейросети
    result = result.replace(/^(Ответ|Answer|Result|Translation|Перевод|Output)\s*:\s*/i, '').trim();

    // 3. Если оригинал однострочный, а ответ содержит \n — вероятно мусор после первой строки
    const originalIsOneLine = !originalText.includes('\n');
    if (originalIsOneLine && result.includes('\n')) {
      // Берём только первую непустую строку
      const firstLine = result.split('\n').map(l => l.trim()).filter(l => l.length > 0)[0];
      if (firstLine) {
        result = firstLine;
      }
    }

    // 4. Если оригинал многострочный — берём столько же строк сколько в оригинале
    if (!originalIsOneLine && result.includes('\n')) {
      const originalLineCount = originalText.split('\n').filter(l => l.trim().length > 0).length;
      const resultLines = result.split('\n');
      // Если в ответе значительно больше строк — обрезаем
      if (resultLines.length > originalLineCount * 2) {
        result = resultLines.slice(0, originalLineCount).join('\n');
      }
    }

    // 5. Если результат всё ещё более чем в 3 раза длиннее оригинала — обрезаем
    if (result.length > originalText.length * 3 && originalText.length > 0) {
      // Берём только первое "предложение" или строку
      const firstSentence = result.match(/^[^\n]+/);
      if (firstSentence) {
        result = firstSentence[0].trim();
      }
    }

    // 6. Повторно убираем кавычки и префиксы после всех очисток
    result = result.replace(/^(Ответ|Answer|Result|Translation|Перевод|Output)\s*:\s*/i, '').trim();
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith('«') && result.endsWith('»')) ||
        (result.startsWith("'") && result.endsWith("'"))) {
      result = result.slice(1, -1).trim();
    }

    return result;
  }

  /**
   * Обработка применения текста к нодам
   */
  private async handleApplyText(message: any): Promise<void> {
    try {
      const appliedCount = await applyTextToNodes(message.text, message.targetNodeIds, message.id);

      sendToUI({
        type: 'text-applied',
        id: message.id,
        success: true,
        appliedCount,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Applied to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Failed to apply text:', error);
      sendToUI({
        type: 'text-applied',
        id: message.id,
        success: false,
        appliedCount: 0,
        error: error.message,
      });
    }
  }

  /**
   * Обработка отмены генерации
   */
  private async handleCancelGeneration(message: any): Promise<void> {
    const abortSignal = this.activeGenerations.get(message.generationId);
    if (abortSignal) {
      abortSignal.abort();
      this.activeGenerations.delete(message.generationId);

      sendToUI({
        type: 'notification',
        level: 'info',
        message: 'Generation cancelled',
      });
    }
  }

  /**
   * Получение выбранных текстовых слоёв
   */
  private async handleGetSelectedText(message: any): Promise<void> {
    try {
      const textNodes = await getSelectedTextNodes();

      if (textNodes.length === 0) {
        sendToUI({
          type: 'notification',
          level: 'warning',
          message: 'No text layers selected',
        });
        return;
      }

      // Извлекаем текст из всех выбранных текстовых элементов
      const text = textNodes.map(node => node.characters).join('\n\n');

      sendToUI({
        type: 'selected-text-loaded',
        id: message.id,
        text,
      });
    } catch (error) {
      console.error('Failed to get selected text:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to get selected text: ' + (error as Error).message,
      });
    }
  }

  /**
   * Тест подключения к провайдеру
   */
  private async handleTestConnection(message: any): Promise<void> {
    const provider = message.provider;
    console.log('[TEST CONNECTION] Testing provider:', provider);

    try {
      const settings = await this.storageManager.loadSettings();

      let success = false;
      let errorMessage = '';

      if (provider === 'lmstudio') {
        const config = settings.providers.lmstudio;
        if (!config) {
          throw new Error('LM Studio is not configured');
        }

        const url = `${config.baseUrl}/models`;
        console.log('[TEST CONNECTION] LM Studio URL:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        success = response.ok;
        if (!success) {
          errorMessage = `HTTP ${response.status}: ${await response.text()}`;
        } else {
          console.log('[TEST CONNECTION] LM Studio response:', await response.text());
        }

      } else if (provider === 'yandex') {
        // Yandex Cloud не поддерживает CORS с null origin (Figma плагины)
        // Тест подключения невозможен напрямую из плагина
        errorMessage = 'Yandex Cloud does not support CORS from Figma plugins. Test by generating text instead.';
        success = false;

      } else if (provider === 'openai-compatible') {
        const config = settings.providers.openaiCompatible;
        if (!config) {
          throw new Error('OpenAI Compatible provider is not configured');
        }

        const url = `${config.baseUrl}/models`;
        console.log('[TEST CONNECTION] OpenAI Compatible URL:', url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
        });

        success = response.ok;
        if (!success) {
          errorMessage = `HTTP ${response.status}: ${await response.text()}`;
        }
      }

      sendToUI({
        type: 'test-connection-result',
        id: message.id,
        success,
        error: errorMessage || undefined,
      });

    } catch (error) {
      console.error('[TEST CONNECTION] Error:', error);
      sendToUI({
        type: 'test-connection-result',
        id: message.id,
        success: false,
        error: error.message || 'Connection test failed',
      });
    }
  }

  /**
   * Тестовая функция перевода выделенного текста
   */
  private async handleTestTranslation(message: any): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Please select a text layer',
        });
        return;
      }

      // Проверяем что выделен текстовый элемент
      const node = selection[0];
      if (node.type !== 'TEXT') {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Selected element is not a text layer',
        });
        return;
      }

      const textNode = node as TextNode;
      const originalText = textNode.characters;

      if (!originalText || originalText.trim() === '') {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'Selected text is empty',
        });
        return;
      }

      // Загружаем настройки LM Studio
      const settings = await this.storageManager.loadSettings();
      const lmStudioConfig = settings.providers.lmstudio;

      if (!lmStudioConfig) {
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: 'LM Studio is not configured',
        });
        return;
      }

      const lmStudioUrl = lmStudioConfig.baseUrl || 'http://localhost:1234/v1';
      const lmStudioModel = lmStudioConfig.model || 'ibm/granite-3.2-8b';

      console.log('[TEST TRANSLATION] URL:', lmStudioUrl);
      console.log('[TEST TRANSLATION] Model:', lmStudioModel);
      console.log('[TEST TRANSLATION] Original text:', originalText);

      // Отправляем запрос к LM Studio
      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: lmStudioModel,
          messages: [
            {
              role: 'user',
              content: `Переведи на английский: ${originalText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        sendToUI({
          type: 'test-translation-result',
          id: message.id,
          success: false,
          error: `API Error ${response.status}: ${errorText}`,
        });
        return;
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content || '';

      sendToUI({
        type: 'test-translation-result',
        id: message.id,
        success: true,
        original: originalText,
        translated: translatedText,
      });

    } catch (error) {
      console.error('[TEST TRANSLATION] Error:', error);
      sendToUI({
        type: 'test-translation-result',
        id: message.id,
        success: false,
        error: error.message || 'Translation failed',
      });
    }
  }

  /**
   * Тестовый перевод напрямую из меню (с минимальным UI для network access)
   */
  private async handleTestTranslationDirect(): Promise<void> {
    try {
      // Проверяем выделение
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.notify('❌ Please select a text layer');
        figma.closePlugin();
        return;
      }

      // Проверяем что выделен текстовый элемент
      const node = selection[0];
      if (node.type !== 'TEXT') {
        figma.notify('❌ Selected element is not a text layer');
        figma.closePlugin();
        return;
      }

      const textNode = node as TextNode;
      const originalText = textNode.characters;

      if (!originalText || originalText.trim() === '') {
        figma.notify('❌ Selected text is empty');
        figma.closePlugin();
        return;
      }

      // Создаём минимальный невидимый UI для доступа к network API
      const html = `
        <html>
          <head><style>body { margin: 0; padding: 0; }</style></head>
          <body>
            <script>
              parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
            </script>
          </body>
        </html>
      `;

      figma.showUI(html, { visible: false, width: 1, height: 1 });
      figma.notify('🔄 Translating...');

      // Сохраняем данные для обработки после загрузки UI
      this.pendingTranslation = {
        textNode,
        originalText,
      };

    } catch (error) {
      console.error('[TEST TRANSLATION DIRECT] Error:', error);
      figma.notify(`❌ Error: ${error.message || 'Translation failed'}`);
      figma.closePlugin();
    }
  }

  /**
   * Показать невидимый UI для фонового быстрого действия LLM
   */
  private async showQuickActionUI(actionId: string): Promise<void> {
    const selectedNodes = figma.currentPage.selection;
    const hasTextLayers = selectedNodes.some(n => n.type === 'TEXT' ||
      ('findAll' in n && (n as FrameNode).findAll(child => child.type === 'TEXT').length > 0));

    if (!hasTextLayers) {
      figma.notify('⚠️ Select text layers first');
      figma.closePlugin();
      return;
    }

    this.pendingQuickActionId = actionId;

    const html = `
      <html>
        <head><style>body { margin: 0; padding: 0; }</style></head>
        <body>
          <script>
            parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
          </script>
        </body>
      </html>
    `;

    figma.showUI(html, { visible: false, width: 1, height: 1 });
    figma.notify('⏳ Processing...');
  }

  /**
   * Выполнение быстрого LLM-действия после загрузки UI (для доступа к fetch)
   */
  private async executeQuickAction(): Promise<void> {
    const actionId = this.pendingQuickActionId;
    this.pendingQuickActionId = null;

    const action = QUICK_ACTIONS.find(qa => qa.id === actionId);
    if (!action) {
      figma.notify('❌ Unknown quick action');
      figma.closePlugin();
      return;
    }

    try {
      // Загружаем настройки и находим первый активный провайдер
      const settings = await this.storageManager.loadSettings();
      let config: any = null;

      // V2.1: ищем в provider groups
      if (settings.providerGroups && settings.providerGroups.length > 0) {
        // Приоритет: активная модель → первая активная в любой группе
        if (settings.activeModelId) {
          const modelInfo = findModelById(settings, settings.activeModelId);
          if (modelInfo && modelInfo.model.enabled && modelInfo.group.enabled) {
            config = modelToUserConfig(modelInfo.group, modelInfo.model);
          }
        }
        if (!config) {
          for (const group of settings.providerGroups) {
            if (!group.enabled) continue;
            const model = group.modelConfigs.find(m => m.enabled);
            if (model) {
              config = modelToUserConfig(group, model);
              break;
            }
          }
        }
      }

      // Fallback: legacy providerConfigs
      if (!config && settings.providerConfigs) {
        config = settings.providerConfigs.find(c => c.enabled);
      }

      if (!config) {
        figma.notify('⚙️ No enabled provider. Open plugin → Settings to configure one.');
        figma.closePlugin();
        return;
      }

      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      if (!baseConfig) {
        figma.notify('⚙️ Provider config not found. Check Settings.');
        figma.closePlugin();
        return;
      }

      const provider = ProviderFactory.createProvider(config, baseConfig);
      const textNodes = await getSelectedTextNodes();

      if (textNodes.length === 0) {
        figma.notify('⚠️ No text layers selected');
        figma.closePlugin();
        return;
      }

      const generationId = generateUniqueId();
      let processedCount = 0;

      for (const node of textNodes) {
        if (!node.characters.trim()) continue;

        const result = await withRetry(() =>
          provider.generateText(node.characters, {
            systemPrompt: action.prompt + '\n\nIMPORTANT: Output ONLY the result. No explanations, labels, quotes, or extra text.',
            temperature: 0,
            maxTokens: Math.min(settings.generation?.maxTokens ?? 2000, 500),
          })
        );

        const cleanResult = this.cleanAIResponse(result.text, node.characters);
        await applyTextToNodes(cleanResult, [node.id], generationId);
        processedCount++;
      }

      const label = action.fallbackLabel;
      figma.notify(`✅ ${label}: ${processedCount} layer${processedCount !== 1 ? 's' : ''} updated`);
    } catch (error) {
      console.error('[QuickAction] Error:', error);
      figma.notify(`❌ ${error.message || 'Generation failed'}`);
    } finally {
      figma.closePlugin();
    }
  }

  /**
   * Выполнение перевода после загрузки UI
   */
  private async executeTranslation(): Promise<void> {
    if (!this.pendingTranslation) return;

    const { textNode, originalText } = this.pendingTranslation;
    this.pendingTranslation = null;

    try {
      // Проверяем доступность fetch API
      if (typeof fetch !== 'function') {
        console.error('[TRANSLATION] fetch is not available');
        figma.notify('❌ Network API not available');
        figma.closePlugin();
        return;
      }

      // Загружаем настройки LM Studio
      const settings = await this.storageManager.loadSettings();
      const lmStudioConfig = settings.providers.lmstudio;

      if (!lmStudioConfig) {
        figma.notify('❌ LM Studio is not configured');
        figma.closePlugin();
        return;
      }

      const lmStudioUrl = lmStudioConfig.baseUrl || 'http://localhost:1234/v1';
      const lmStudioModel = lmStudioConfig.model || 'ibm/granite-3.2-8b';

      console.log('[TRANSLATION] Using URL:', lmStudioUrl);
      console.log('[TRANSLATION] Model:', lmStudioModel);
      console.log('[TRANSLATION] Original text:', originalText);
      console.log('[TRANSLATION] fetch available:', typeof fetch);

      // Отправляем запрос к LM Studio
      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: lmStudioModel,
          messages: [
            {
              role: 'user',
              content: `Переведи на английский: ${originalText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      console.log('[TRANSLATION] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TRANSLATION] Error response:', errorText);
        figma.notify(`❌ API Error ${response.status}`);
        figma.closePlugin();
        return;
      }

      const data = await response.json();
      console.log('[TRANSLATION] Response data:', data);

      const translatedText = data.choices?.[0]?.message?.content || '';

      if (!translatedText) {
        figma.notify('❌ No translation received');
        figma.closePlugin();
        return;
      }

      console.log('[TRANSLATION] Translated text:', translatedText);

      // Обновляем текст в выделенном слое
      await figma.loadFontAsync(textNode.fontName as FontName);
      textNode.characters = translatedText;

      figma.notify('✅ Translation complete!');
      figma.closePlugin();

    } catch (error) {
      console.error('[TRANSLATION] Error:', error);
      figma.notify(`❌ Error: ${error.message || 'Translation failed'}`);
      figma.closePlugin();
    }
  }

  /**
   * Расчёт стоимости генерации по baseConfigId
   * Использует pricing из PROVIDER_CONFIGS ($ per 1M tokens).
   * Для упрощения считаем все токены по усреднённой ставке (input + output) / 2.
   */
  private calculateCost(providerId: string, tokens: number): number {
    // Ищем baseConfigId через provider groups или legacy configs
    const providerConfig = PROVIDER_CONFIGS.find(p => p.id === providerId);

    if (providerConfig && providerConfig.pricing) {
      // Усреднённая ставка (input + output) / 2 за 1M токенов
      const avgPricePerMillion = (providerConfig.pricing.input + providerConfig.pricing.output) / 2;
      return (tokens / 1_000_000) * avgPricePerMillion;
    }

    // Fallback: может быть model ID из provider groups
    // В этом случае providerId — это user config ID, не baseConfigId
    // Для точного расчёта нужен baseConfigId, но его здесь нет
    return 0;
  }

  // ============================================================================
  // Undo Handler
  // ============================================================================

  /**
   * Undo the last text/rename operation
   */
  private async handleUndoLastOperation(message: any): Promise<void> {
    try {
      const result = await undoLastOperation();

      if (result.restoredCount > 0) {
        sendToUI({
          type: 'undo-result',
          id: message.id,
          restoredCount: result.restoredCount,
          operationType: result.operationType,
        });

        figma.notify(`✅ Undo: restored ${result.restoredCount} layer${result.restoredCount !== 1 ? 's' : ''}`);
      } else {
        sendToUI({
          type: 'notification',
          level: 'info',
          message: 'Nothing to undo',
        });
      }
    } catch (error: any) {
      console.error('[Undo] Error:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: `Undo failed: ${error.message}`,
      });
    }
  }

  // ============================================================================
  // Data Presets Handlers
  // ============================================================================

  /**
   * Загрузка пресетов данных
   */
  private async handleLoadDataPresets(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadDataPresets();

      // Merge built-in presets with user presets (built-ins first, avoiding duplicates)
      const builtInPresets = Object.values(BUILT_IN_PRESETS);
      const userPresetIds = new Set(settings.presets.map(p => p.id));
      const mergedPresets = [
        ...builtInPresets.filter(bp => !userPresetIds.has(bp.id)),
        ...settings.presets,
      ];

      sendToUI({
        type: 'data-presets-loaded',
        id: message.id,
        settings: {
          ...settings,
          presets: mergedPresets,
        },
      });
    } catch (error) {
      console.error('Failed to load data presets:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to load data presets',
      });
    }
  }

  /**
   * Сохранение пресетов данных
   */
  private async handleSaveDataPresets(message: any): Promise<void> {
    try {
      await this.storageManager.saveDataPresets(message.settings);

      sendToUI({
        type: 'notification',
        level: 'success',
        message: 'Presets saved',
      });
    } catch (error) {
      console.error('Failed to save data presets:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to save presets',
      });
    }
  }

  /**
   * Применение подстановки данных (последовательное - каждая группа к своему компоненту)
   */
  private async handleApplyDataSubstitution(message: any): Promise<void> {
    try {
      // Check built-in presets first (they are never stored in clientStorage)
      const builtInKey = message.presetId.startsWith('built-in-')
        ? message.presetId.replace('built-in-', '')
        : null;
      let preset: DataPreset | undefined = builtInKey ? BUILT_IN_PRESETS[builtInKey] : undefined;

      // Fall back to user presets in storage
      if (!preset) {
        const settings = await this.storageManager.loadDataPresets();
        preset = settings.presets.find(function (p) {
          return p.id === message.presetId;
        });
      }

      if (!preset) {
        throw new Error('Preset not found');
      }

      // Применить подстановку ПОСЛЕДОВАТЕЛЬНО (группа 1 → компонент 1, и т.д.)
      const result = await applyDataSubstitutionSequential(preset);

      sendToUI({
        type: 'substitution-applied',
        id: message.id,
        success: true,
        nodesProcessed: 0,  // Не используется в новом режиме
        componentsProcessed: result.componentsProcessed,
        groupsUsed: result.groupsUsed,
      });

      const message_text = 'Applied ' + result.groupsUsed + ' groups to ' + result.componentsProcessed + ' components';

      sendToUI({
        type: 'notification',
        level: 'success',
        message: message_text,
      });
    } catch (error) {
      console.error('Failed to apply data substitution:', error);

      sendToUI({
        type: 'substitution-applied',
        id: message.id,
        success: false,
        nodesProcessed: 0,
        componentsProcessed: 0,
        groupsUsed: 0,
        error: error.message,
      });

      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Failed to apply substitution',
      });
    }
  }

  /**
   * Быстрое применение пресета (без UI)
   */
  private async quickApplyPreset(presetId: string, builtInPreset?: DataPreset): Promise<void> {
    try {
      let preset: DataPreset | undefined = builtInPreset;

      if (!preset) {
        const settings = await this.storageManager.loadDataPresets();
        preset = settings.presets.find(function (p) {
          return p.id === presetId;
        });
      }

      if (!preset) {
        figma.notify('Preset not found');
        return;
      }

      // Применяем последовательно
      const result = await applyDataSubstitutionSequential(preset);

      if (result.componentsProcessed > 0) {
        figma.notify('Applied ' + result.groupsUsed + ' groups to ' + result.componentsProcessed + ' components');
      } else {
        figma.notify('No components processed. Select frames or components with text layers.');
      }
    } catch (error) {
      console.error('Quick apply error:', error);
      figma.notify('Error: ' + error.message);
    }
  }

  /**
   * Показать UI для обратного переименования
   */
  private async showReverseRenameUI(): Promise<void> {
    const settings = await this.storageManager.loadDataPresets();
    const allPresets = [...Object.values(BUILT_IN_PRESETS), ...settings.presets];

    // Фильтруем только те, у которых есть defaultValues
    const presetsWithDefaults = allPresets.filter(function (p) {
      return p.defaultValues && Object.keys(p.defaultValues).length > 0;
    });

    if (presetsWithDefaults.length === 0) {
      figma.notify('No presets with default values. Add default values to presets first.');
      figma.closePlugin();
      return;
    }

    let html = '<html><head><style>';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12px; margin: 0; font-size: 12px; }';
    html += '.preset-item { padding: 8px 12px; margin: 4px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; transition: all 0.2s; }';
    html += '.preset-item:hover { background: #f0f0f0; border-color: #18a0fb; }';
    html += '.preset-name { font-weight: 600; margin-bottom: 2px; }';
    html += '.preset-info { font-size: 10px; color: #999; }';
    html += '</style></head><body>';
    html += '<h3 style="margin: 0 0 12px 0;">Rename Layers by Content</h3>';

    for (const preset of presetsWithDefaults) {
      html += '<div class="preset-item" onclick="parent.postMessage({ pluginMessage: { type: \'reverse-rename\', presetId: \'' + preset.id + '\' } }, \'*\')">';
      html += '<div class="preset-name">' + preset.name + '</div>';
      html += '<div class="preset-info">' + Object.keys(preset.defaultValues!).length + ' default values</div>';
      html += '</div>';
    }

    html += '</body></html>';

    figma.showUI(html, {
      width: 300,
      height: Math.min(400, 100 + presetsWithDefaults.length * 60),
      themeColors: true,
    });
  }

  /**
   * Обработчик обратного переименования
   */
  private async handleReverseRename(presetId: string): Promise<void> {
    try {
      // Ищем в встроенных пресетах
      let preset: DataPreset | undefined = BUILT_IN_PRESETS[presetId.replace('built-in-', '')];

      // Если не нашли, ищем в пользовательских
      if (!preset) {
        const settings = await this.storageManager.loadDataPresets();
        preset = settings.presets.find(function (p) {
          return p.id === presetId;
        });
      }

      if (!preset) {
        figma.notify('Preset not found');
        return;
      }

      const result = await reverseRenameByContent(preset);

      if (result.nodesRenamed > 0) {
        figma.notify('Renamed ' + result.nodesRenamed + ' layers based on content');
      } else {
        figma.notify('No matching content found in selected layers');
      }
    } catch (error) {
      console.error('Reverse rename error:', error);
      figma.notify('Error: ' + error.message);
    }

    figma.closePlugin();
  }

  /**
   * Обработчик быстрого применения из UI (если понадобится)
   */
  private async handleQuickApplyPreset(message: any): Promise<void> {
    await this.quickApplyPreset(message.presetId);
  }

  /**
   * Handle batch generation (V2)
   */
  private async handleGenerateBatch(message: any): Promise<void> {
    try {
      const settings = await this.storageManager.loadSettings();

      // Get active provider config (v2 architecture)
      const config = settings.providerConfigs?.find(c => c.id === settings.activeProviderId);

      if (!config || !config.enabled) {
        // Fallback to legacy provider if v2 not configured
        throw new Error('No active provider configuration. Please configure a provider in Settings.');
      }

      const baseConfig = PROVIDER_CONFIGS.find(p => p.id === config.baseConfigId);
      if (!baseConfig) {
        throw new Error('Provider configuration not found');
      }

      const provider = ProviderFactory.createProvider(config, baseConfig);

      // Get selected text nodes
      const textNodes = await getSelectedTextNodes();
      if (textNodes.length === 0) {
        throw new Error('No text layers selected');
      }

      const result = await this.batchProcessor.processBatch(
        textNodes,
        provider,
        message.prompt,
        settings.generation,
      );

      sendToUI({
        type: 'generate-batch-complete',
        id: message.id,
        success: true,
        processed: result.successful,
        failed: result.failed,
        totalTokens: result.totalTokens,
        totalCost: result.totalCost,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Batch completed: ${result.successful} successful, ${result.failed} failed`,
      });
    } catch (error: any) {
      console.error('Batch generation error:', error);
      sendToUI({
        type: 'generate-batch-complete',
        id: message.id,
        success: false,
        processed: 0,
        failed: 0,
        totalTokens: 0,
        totalCost: 0,
      });

      sendToUI({
        type: 'notification',
        level: 'error',
        message: error.message || 'Batch generation failed',
      });
    }
  }

  // ============================================================================
  // Multi-field Generation Handlers
  // ============================================================================

  /**
   * Get selected text layers (for multi-field UI)
   */
  private async handleGetSelectedLayers(message: any): Promise<void> {
    try {
      const textNodes = await getSelectedTextNodes();

      sendToUI({
        type: 'selected-layers-loaded',
        id: message.id,
        layers: textNodes.map(n => ({
          id: n.id,
          name: n.name,
          characters: n.characters,
        })),
      });
    } catch (error: any) {
      console.error('Failed to get selected layers:', error);
      sendToUI({
        type: 'notification',
        level: 'error',
        message: 'Failed to get selected layers: ' + error.message,
      });
    }
  }

  /**
   * Handle multi-field generation — generates text for each layer sequentially
   */
  private async handleGenerateMulti(message: any): Promise<void> {
    const abortSignal = new SimpleAbortSignal();
    this.activeGenerations.set(message.id, abortSignal);

    try {
      const startTime = Date.now();
      const results: Array<{
        layerId: string;
        layerName: string;
        originalText: string;
        generatedText: string;
        tokens: number;
        cost: number;
      }> = [];
      let totalTokens = 0;
      let totalCost = 0;

      for (let i = 0; i < message.layers.length; i++) {
        if (abortSignal.aborted) break;

        const layer = message.layers[i];

        // Build contextual prompt for this layer
        const contextPrompt = `${message.prompt}\n\nOriginal text from layer "${layer.name}":\n${layer.originalText}`;

        let layerText = '';
        let layerTokens = 0;

        await withRetry(async () => {
          await this.apiClient.generateText({
            providerId: message.providerId,
            prompt: contextPrompt,
            systemPrompt: message.systemPrompt,
            settings: message.settings,
            signal: abortSignal,
            onChunk: (chunk: string, tokens: number) => {
              layerText += chunk;
              layerTokens = tokens;

              // Send progress for this layer
              sendToUI({
                type: 'generation-multi-chunk',
                id: message.id,
                layerIndex: i,
                text: layerText,
                tokens: totalTokens + layerTokens,
              });
            },
          });
        });

        const layerCost = this.calculateCost(message.providerId, layerTokens);

        results.push({
          layerId: layer.id,
          layerName: layer.name,
          originalText: layer.originalText,
          generatedText: layerText,
          tokens: layerTokens,
          cost: layerCost,
        });

        totalTokens += layerTokens;
        totalCost += layerCost;

        // Small delay between layers to avoid rate limits
        if (i < message.layers.length - 1 && !abortSignal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const duration = Date.now() - startTime;

      // Track usage
      await this.storageManager.trackTokenUsage(message.providerId, totalTokens, totalCost);

      sendToUI({
        type: 'generation-multi-complete',
        id: message.id,
        results,
        totalTokens,
        totalCost,
        duration,
      });
    } catch (error: any) {
      console.error('Multi-generation error:', error);
      sendToUI({
        type: 'generation-multi-error',
        id: message.id,
        error: error.message || 'Multi-field generation failed',
      });
    } finally {
      this.activeGenerations.delete(message.id);
    }
  }

  /**
   * Cancel multi-field generation
   */
  private handleCancelMultiGeneration(message: any): void {
    const abortSignal = this.activeGenerations.get(message.id);
    if (abortSignal) {
      abortSignal.abort();
      this.activeGenerations.delete(message.id);
      sendToUI({
        type: 'notification',
        level: 'info',
        message: 'Multi-field generation cancelled',
      });
    }
  }

  /**
   * Apply multi-field results to layers
   */
  private async handleApplyMultiResults(message: any): Promise<void> {
    try {
      let appliedCount = 0;

      for (const result of message.results) {
        const node = figma.getNodeById(result.layerId);
        if (node && node.type === 'TEXT') {
          const textNode = node as TextNode;
          // Load the font before changing text
          if (textNode.fontName !== figma.mixed) {
            await figma.loadFontAsync(textNode.fontName);
          } else {
            // Mixed fonts — load all unique fonts
            const len = textNode.characters.length;
            const fontsToLoad = new Set<string>();
            for (let i = 0; i < len; i++) {
              const fontName = textNode.getRangeFontName(i, i + 1) as FontName;
              const key = `${fontName.family}-${fontName.style}`;
              if (!fontsToLoad.has(key)) {
                fontsToLoad.add(key);
                await figma.loadFontAsync(fontName);
              }
            }
          }
          textNode.characters = result.text;
          appliedCount++;
        }
      }

      sendToUI({
        type: 'multi-results-applied',
        id: message.id,
        success: true,
        appliedCount,
      });

      sendToUI({
        type: 'notification',
        level: 'success',
        message: `Applied text to ${appliedCount} layer${appliedCount !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      console.error('Failed to apply multi results:', error);
      sendToUI({
        type: 'multi-results-applied',
        id: message.id,
        success: false,
        appliedCount: 0,
        error: error.message,
      });
    }
  }
}

// Инициализация плагина
new PluginSandbox();
