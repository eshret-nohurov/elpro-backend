const formatPrice = value => `${Number(value || 0).toLocaleString('ru-RU')} тмт`;

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');

const formatDate = date =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Asia/Ashgabat',
	}).format(new Date(date));

const buildProductRows = products =>
	products
		.map(
			product => `
				<tr>
					<td style="padding:14px 0;border-bottom:1px solid #e5e7eb;">
						<div style="font-weight:700;color:#111827;">${escapeHtml(product.name)}</div>
						<div style="margin-top:4px;color:#6b7280;font-size:13px;">ID: ${escapeHtml(product._id)}</div>
					</td>
					<td style="padding:14px 0;border-bottom:1px solid #e5e7eb;text-align:center;color:#111827;">${product.quantity}</td>
					<td style="padding:14px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">
						<div>${formatPrice(product.price)}</div>
						${product.hasDiscount ? `<div style="margin-top:4px;color:#dc2626;font-size:12px;font-weight:700;">Скидка -${product.discountPercent}%</div><div style="margin-top:2px;color:#94a3b8;font-size:12px;text-decoration:line-through;">${formatPrice(product.originalPrice)}</div>` : ''}
					</td>
					<td style="padding:14px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;">${formatPrice(product.price * product.quantity)}</td>
				</tr>`
		)
		.join('');

const baseLayout = ({ title, subtitle, badge, body }) => `
	<div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
		<div style="max-width:720px;margin:0 auto;padding:28px 14px;">
			<div style="overflow:hidden;border-radius:24px;background:#ffffff;box-shadow:0 18px 50px rgba(15,23,42,.10);">
				<div style="background:#0f172a;padding:28px 30px;color:#ffffff;">
					<div style="font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#38bdf8;">ELPRO STORE</div>
					<h1 style="margin:12px 0 8px;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
					<p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">${escapeHtml(subtitle)}</p>
					${badge ? `<div style="display:inline-block;margin-top:18px;border-radius:999px;background:#0284c7;padding:8px 14px;font-size:13px;font-weight:700;">${escapeHtml(badge)}</div>` : ''}
				</div>
				<div style="padding:30px;">
					${body}
				</div>
			</div>
			<p style="margin:18px 8px 0;color:#6b7280;font-size:12px;text-align:center;line-height:1.5;">
				Это письмо отправлено автоматически сайтом elpro.store.
			</p>
		</div>
	</div>`;

const customerInfoBlock = order => `
	<div style="display:grid;gap:12px;margin:0 0 24px;">
		<div style="border-radius:18px;background:#f8fafc;padding:18px;">
			<div style="font-size:13px;color:#64748b;">Клиент</div>
			<div style="margin-top:5px;font-size:18px;font-weight:800;color:#111827;">${escapeHtml(order.name)}</div>
			<div style="margin-top:6px;color:#334155;">${escapeHtml(order.phone)}</div>
			${order.email ? `<div style="margin-top:4px;color:#334155;">${escapeHtml(order.email)}</div>` : ''}
		</div>
		<div style="border-radius:18px;background:#f8fafc;padding:18px;">
			<div style="font-size:13px;color:#64748b;">Получение заказа</div>
			<div style="margin-top:5px;font-weight:700;color:#111827;">${order.isPickup ? 'Самовывоз' : 'Доставка'}</div>
			<div style="margin-top:6px;color:#334155;">${escapeHtml(order.location)}</div>
			${order.isPickup ? '<div style="margin-top:4px;color:#334155;">Алемгошар базар (100 фонтанов), 109-й магазин</div>' : `<div style="margin-top:4px;color:#334155;">${escapeHtml(order.address)}</div>`}
		</div>
		${order.comment ? `<div style="border-radius:18px;background:#fff7ed;padding:18px;"><div style="font-size:13px;color:#9a3412;">Комментарий</div><div style="margin-top:6px;color:#431407;line-height:1.5;">${escapeHtml(order.comment)}</div></div>` : ''}
	</div>`;

const productsTable = order => `
	<table style="width:100%;border-collapse:collapse;margin-top:10px;">
		<thead>
			<tr>
				<th style="padding:0 0 10px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Товар</th>
				<th style="padding:0 0 10px;text-align:center;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Кол.</th>
				<th style="padding:0 0 10px;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Цена</th>
				<th style="padding:0 0 10px;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Сумма</th>
			</tr>
		</thead>
		<tbody>${buildProductRows(order.products)}</tbody>
	</table>
	<div style="margin-top:20px;border-radius:18px;background:#0f172a;padding:18px;color:#ffffff;">
		<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:8px;font-size:14px;color:#cbd5e1;">
			<span>Товары</span>
			<strong style="color:#ffffff;">${formatPrice(order.subtotalPrice ?? order.totalPrice)}</strong>
		</div>
		<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:12px;font-size:14px;color:#cbd5e1;">
			<span>Доставка</span>
			<strong style="color:#ffffff;">${order.deliveryPrice > 0 ? formatPrice(order.deliveryPrice) : 'Бесплатно'}</strong>
		</div>
		<div style="border-top:1px solid rgba(255,255,255,.14);padding-top:12px;font-size:13px;color:#cbd5e1;">Итого</div>
		<div style="margin-top:4px;font-size:26px;font-weight:900;">${formatPrice(order.totalPrice)}</div>
	</div>`;

const buildAdminOrderEmail = order => ({
	subject: `ELPRO: новый заказ на ${formatPrice(order.totalPrice)}`,
	text: `Новый заказ от ${order.name}. Телефон: ${order.phone}. Сумма: ${formatPrice(order.totalPrice)}.`,
	html: baseLayout({
		title: 'Поступил новый заказ',
		subtitle: 'Проверьте заказ в админ-панели и свяжитесь с клиентом как можно быстрее.',
		badge: `Заказ от ${formatDate(order.createdAt)}`,
		body: `
			${customerInfoBlock(order)}
			${productsTable(order)}
			<div style="margin-top:24px;border-radius:18px;border:1px solid #e5e7eb;padding:18px;color:#334155;line-height:1.6;">
				<strong style="color:#111827;">Что дальше:</strong><br />
				1. Откройте раздел «Заказы» в админке.<br />
				2. Проверьте наличие товаров и условия доставки.<br />
				3. Свяжитесь с клиентом по телефону ${escapeHtml(order.phone)}.
			</div>`,
	}),
});

const buildCustomerOrderEmail = order => ({
	subject: 'ELPRO: мы получили ваш заказ',
	text: `Здравствуйте, ${order.name}! Мы получили ваш заказ на сумму ${formatPrice(order.totalPrice)}. Менеджер свяжется с вами для подтверждения.`,
	html: baseLayout({
		title: 'Спасибо, заказ получен',
		subtitle: 'Мы уже передали его менеджеру. Скоро свяжемся с вами, чтобы уточнить детали и подтвердить наличие.',
		badge: `Сумма заказа: ${formatPrice(order.totalPrice)}`,
		body: `
			<p style="margin:0 0 18px;color:#334155;line-height:1.7;">Здравствуйте, <strong style="color:#111827;">${escapeHtml(order.name)}</strong>! Ниже оставили состав заказа и контактные данные, которые вы указали.</p>
			${customerInfoBlock(order)}
			${productsTable(order)}
			<div style="margin-top:24px;border-radius:18px;background:#e0f2fe;padding:18px;color:#0c4a6e;line-height:1.6;">
				<strong>Важно:</strong> сейчас вы ни за что не платите. Наш менеджер свяжется с вами, подтвердит заказ и согласует доставку или самовывоз.
			</div>`,
	}),
});

module.exports = {
	buildAdminOrderEmail,
	buildCustomerOrderEmail,
};
