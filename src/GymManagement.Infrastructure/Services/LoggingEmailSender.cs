using GymManagement.Application.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GymManagement.Infrastructure.Services;

/// <summary>
/// Placeholder email sender. In development it writes the email (including reset links) to the log
/// so the flow can be tested without a mail server. Outside development it never logs the body,
/// because reset links are secrets; plug in a real provider (SMTP, SendGrid, ...) before going live.
/// </summary>
public sealed class LoggingEmailSender(IHostEnvironment environment, ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string body, CancellationToken ct = default)
    {
        if (environment.IsDevelopment())
        {
            logger.LogInformation("DEV EMAIL to {To} | {Subject}\n{Body}", toEmail, subject, body);
        }
        else
        {
            logger.LogWarning("No email provider configured; email '{Subject}' was not sent", subject);
        }

        return Task.CompletedTask;
    }
}
