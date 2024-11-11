from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
import json
from time import sleep
import sys
chrome_option = Options()
chrome_option.add_experimental_option("detach", True)
driver = webdriver.Chrome()
base_url = "https://www.thaiticketmajor.com/concert/"
userdetail_file = "userdetail.json"
count = 0
with open(userdetail_file, 'r') as f:
    user = json.load(f)
email = user["email"]
password = user["pwd"]
zone = user["zone"]
concert = user["concert"]
seat = int(user["seats"])
zone_list = 0
show = int(user["show"])
next_zone_index = 1


def setUp():
    driver.maximize_window()
    driver.get(base_url)
    driver.implicitly_wait(100)


def Login():
    driver.find_element(
        By.XPATH, '//*[@class="btn-signin item d-none d-lg-inline-block"]').click()
    sleep(1)
    username = driver.find_element(By.NAME, "username")
    username.send_keys(email)
    pwd = driver.find_element(By.NAME, "password")
    pwd.send_keys(password)
    driver.find_element(By.XPATH, '//*[@class="btn-red btn-signin"]').click()
    sleep(2)
    cur_url = driver.current_url
    while cur_url == base_url:
        element = driver.find_element(By.PARTIAL_LINK_TEXT, concert)

        myClick(element)
        cur_url = driver.current_url


def SelectShow():
    element = driver.find_element(
        By.XPATH, '//*[@class="btn-red btn-buynow btn-item"]')
    myClick(element)

    result = findUrl("verify_condition", driver.current_url)

    if result:
        element = driver.find_element(By.ID, "rdagree")
        myClick(element)
        # btn-solid-round5-blue w-auto
        driver.find_element(
            By.ID, 'btn_verify').click()


def findUrl(msg, link):
    if (link.find(msg) > 0):
        return True
    else:
        return False


def SelectZone(zone=zone):

    count_zone = driver.execute_script(
        "return document.getElementsByTagName('area').length")

    index = 0
    for i in range(1, count_zone+1):
        seat = driver.find_element(
            By.XPATH, f'//*[@name="uMap2Map"]/area[{i}]').get_attribute("href")
        result = finZone(zone, seat)
        if result:
            index = i
            break
    driver.find_element(
        By.XPATH, f'//*[@name="uMap2Map"]/area[{index}]').click()


def finZone(msg, link):
    get_zone = link.split('#')
    if msg == get_zone[2]:
        return True
    else:
        return False


def SelectSeat(number=seat):

    global count
    count_loop = driver.execute_script(
        "return document.getElementsByClassName('seatuncheck').length")
    for i in range(1, count_loop+1):
        print(i)
        driver.execute_script(
            f"document.getElementsByClassName('seatuncheck')[{i}].click()")
        result = driver.execute_script(
            "return document.getElementsByClassName('seatchecked').length")
        if result == number:
            break

    sleep(100)


def go_to_next_zone():
    global next_zone_index
    while next_zone_index <= zone_list:
        driver.find_element_by_partial_link_text("ย้อนกลับ / Back").click()
        driver.implicitly_wait(40)
        driver.find_element_by_partial_link_text(
            "ที่นั่งว่าง / Seats Available").click()
        driver.implicitly_wait(30)
        for j in range(2, zone_list+1):
            amount = driver.find_element_by_xpath(
                f"//*[@class='container-popup']/table[1]/tbody[1]/tr[{j}]/td[2]").text
            i = driver.find_element_by_xpath(
                f"//*[@class='container-popup']/table[1]/tbody[1]/tr[{j}]/td[1]").text
            if amount != "0" or amount == "Available":
                SelectZone(i)
                SelectSeat()
            next_zone_index += 1
    if count == 0:
        print(f"Sorry, this concert don't have any seat for you.")
        sys.exit()


def confirm_ticketprotect():
    driver.find_element_by_partial_link_text(
        "ยืนยันที่นั่ง / Book Now").click()
    driver.implicitly_wait(50)
    driver.find_element_by_partial_link_text("Continue").click()
    driver.implicitly_wait(40)


def myClick(elm):
    actions = ActionChains(driver)
    actions.move_to_element(elm).perform()
    driver.execute_script("arguments[0].click();", elm)


setUp()
Login()
SelectShow()
SelectZone(zone)
SelectSeat()
if count==0:
    go_to_next_zone()
