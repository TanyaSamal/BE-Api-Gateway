const { parentPort, workerData } = require('worker_threads');

// Интенсивная CPU-нагрузка (например, сложный расчет или архивация)
function generateHeavyReport(data) {
  const start = Date.now();
  let iterations = 0;
  
  // Симулируем тяжелую работу на 3 секунды, которая намертво заблокировала бы Event Loop
  while (Date.now() - start < 3000) {
    iterations++;
  }

  return {
    success: true,
    reportId: data.reportId,
    generatedAt: new Date().toISOString(),
    processedItems: iterations,
    meta: `Обработано аналитики для клиента: ${data.clientName}`,
  };
}

// Слушаем данные от основного потока
const result = generateHeavyReport(workerData);

// Отправляем результат обратно и завершаем поток
parentPort.postMessage(result);
