<?php
$sub_menu = '950100';
include_once('./_common.php');

if (function_exists('auth_check_menu')) auth_check_menu($auth, $sub_menu, 'r');
else auth_check($auth[$sub_menu], 'r');

$g5['title'] = '입금 모니터';
include_once('./admin.head.php');
// 입금 모니터는 같은 도메인의 /deposit/ 경로(nginx 프록시)로 열린다. 처음 한 번 접속 토큰을 묻고 브라우저에 기억한다.
?>
<div style="margin:0 -20px">
  <iframe src="/deposit/" style="width:100%;height:calc(100vh - 160px);min-height:600px;border:0;display:block" title="입금 모니터"></iframe>
</div>
<p style="margin-top:8px"><a href="/deposit/" target="_blank">새 창으로 열기</a></p>
<?php
include_once('./admin.tail.php');
